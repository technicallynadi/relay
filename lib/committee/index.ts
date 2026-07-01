// The jury: a panel of diverse LLM judges (Panel of LLM evaluators / PoLL; Verga et al.
// 2024) that each rank the candidates independently, and we gate the routing on how much
// they agree — Kendall's W, the coefficient of concordance (Kendall & Babington Smith,
// 1939). High concordance + a clear Borda winner ⇒ auto-route; a split jury ⇒ escalate.

import {
  CRITERIA,
  type Candidate,
  type CommitteeResult,
  type Criterion,
  type Job,
  type Judge,
  type JudgeRead,
  type SubScores,
  type Weights,
} from "@/lib/types";
import { chat, parseJson, resolveModel } from "@/lib/models";
import { CRITERION_LABEL } from "@/lib/committee/personality";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// Normalized weighted sum of a candidate's sub-scores under a judge's weights → 0-1.
export function judgeScore(sub: SubScores, w: Weights): number {
  let num = 0;
  let den = 0;
  for (const c of CRITERIA) {
    num += w[c] * sub[c];
    den += w[c];
  }
  return den ? num / den : 0;
}

// Ranks for one judge's preference vector: rank 1 = best (highest score). Equal scores
// share the average (mid) rank. Aligned to the `preference` index order.
function ranksOf(preference: number[]): number[] {
  const n = preference.length;
  const idx = preference.map((_, i) => i).sort((a, b) => preference[b] - preference[a]);
  const ranks = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && preference[idx[j + 1]] === preference[idx[i]]) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank across the tie group
    for (let k = i; k <= j; k++) ranks[idx[k]] = avg;
    i = j + 1;
  }
  return ranks;
}

// Kendall's W (coefficient of concordance) over m judges ranking n candidates. W = 1 →
// the jury agrees on one ranking; W = 0 → no better than random. Also returns the
// per-candidate rank-sum, which drives the Borda consensus winner.
export function kendallW(reads: JudgeRead[]): { W: number; rankSum: number[] } {
  const m = reads.length;
  const n = reads[0]?.preference.length ?? 0;
  const rankSum = new Array<number>(n).fill(0);
  for (const r of reads) {
    const ranks = ranksOf(r.preference);
    for (let i = 0; i < n; i++) rankSum[i] += ranks[i];
  }
  if (m < 1 || n < 2) return { W: 1, rankSum };
  const meanR = (m * (n + 1)) / 2;
  let S = 0;
  for (const R of rankSum) S += (R - meanR) ** 2;
  const W = (12 * S) / (m * m * (n ** 3 - n));
  return { W: clamp01(W), rankSum };
}

const DEFAULT_MARGIN_FLOOR = 0.15;

export interface GateInput {
  candidateOrder: string[];
  reads: JudgeRead[];
  minAgreement: number; // required jury concordance (Kendall's W) to auto-route
  marginFloor?: number; // the winner must clear the runner-up by this Borda margin
}

// The jury gate. Pure: given the judges' rankings, decide auto-route vs escalate.
// Auto-route only when the jury's concordance clears `minAgreement` AND the Borda winner
// clears the runner-up by `marginFloor` — concordance scores the whole ranking, the
// margin guard protects the one thing routing cares about: the top slot.
export function gate({
  candidateOrder,
  reads,
  minAgreement,
  marginFloor = DEFAULT_MARGIN_FLOOR,
}: GateInput): CommitteeResult {
  const m = reads.length;
  const n = candidateOrder.length;
  const { W, rankSum } = kendallW(reads);
  const avgPairwiseAgreement = m > 1 ? (m * W - 1) / (m - 1) : 1;

  // Borda points bᵢ = m·n − rankSumᵢ (higher = better) → consensus winner + runner-up.
  const borda = rankSum.map((R) => m * n - R);
  const byBorda = candidateOrder.map((_, i) => i).sort((a, b) => borda[b] - borda[a]);
  const winnerIdx = byBorda[0] ?? 0;
  const runnerIdx = byBorda[1] ?? winnerIdx;
  const spread = m * (n - 1);
  const topMargin = spread > 0 ? clamp01((borda[winnerIdx] - borda[runnerIdx]) / spread) : 1;
  const winnerId = candidateOrder[winnerIdx] ?? null;
  const runnerUpId = candidateOrder[runnerIdx] ?? null;

  const converged = W >= minAgreement && topMargin >= marginFloor;
  const base = {
    candidateOrder,
    reads,
    concordance: W,
    avgPairwiseAgreement,
    minAgreement,
    topMargin,
    marginFloor,
  };

  if (converged) {
    return { ...base, converged: true, consensusPartnerId: winnerId, decision: "auto_route_eligible" };
  }
  const reason =
    W < minAgreement
      ? `jury agreement W=${W.toFixed(2)} is below the required ${minAgreement.toFixed(2)}`
      : `the top two are within the margin guard (${topMargin.toFixed(2)} < ${marginFloor.toFixed(2)})`;
  return {
    ...base,
    converged: false,
    consensusPartnerId: null,
    decision: "escalated",
    split:
      winnerId && runnerUpId
        ? { partnerAId: winnerId, partnerBId: runnerUpId, note: `Jury split — ${reason}. Human decides.` }
        : undefined,
  };
}

// --- The LLM evidence-read (the load-bearing, non-linear part) ---

interface JudgeLLMOut {
  adjustments: { id: string; fit?: number; customerExperience?: number; note?: string }[];
  rationale: string;
}

function judgeSystemPrompt(judge: Judge): string {
  const ranked = [...CRITERIA].sort((a, b) => judge.weights[b] - judge.weights[a]);
  const priorities = ranked.slice(0, 3).map((c) => CRITERION_LABEL[c]).join(", ");
  return [
    `You are "${judge.name}", an evaluator on a referral-routing committee. Role: ${judge.role}.`,
    `You prioritize, in order: ${priorities}.`,
    `Each candidate partner comes with pre-computed sub-scores (0-1) plus a raw capability sheet and customer reviews.`,
    `Read the unstructured text. Where it reveals something the numbers miss for THIS job, adjust that partner's "fit" and/or "customerExperience" (0-1) up or down — otherwise omit them. Stay grounded in the text; do not invent facts.`,
    `Reply ONLY as JSON: {"adjustments":[{"id":"<partnerId>","fit":<0-1 optional>,"customerExperience":<0-1 optional>,"note":"<short why>"}],"rationale":"<one line, in your lens>"}`,
  ].join("\n");
}

function judgeUserPrompt(job: Job, candidates: Candidate[]): string {
  const cands = candidates
    .map((c) => {
      const s = c.subScores;
      return [
        `--- Partner ${c.partner.id}: ${c.partner.name} (${c.partner.trade}${c.partner.brandId ? ", in-network" : ", out-of-network"})`,
        `sub-scores: fit ${s.fit.toFixed(2)}, capacity ${s.capacity.toFixed(2)}, proximity ${s.proximity.toFixed(2)}, conversion ${s.conversion.toFixed(2)}, customerExperience ${s.customerExperience.toFixed(2)}`,
        `capability: ${c.partner.capabilitySheet}`,
        `reviews: ${c.partner.reviews.map((r) => `"${r}"`).join(" ")}`,
      ].join("\n");
    })
    .join("\n");
  return [
    `Completed job: ${job.summary}`,
    `Tech notes: ${job.techNotes}`,
    `Customer location: ${job.location.label}`,
    ``,
    `Candidates:`,
    cands,
  ].join("\n");
}

export async function runJudge(judge: Judge, candidates: Candidate[], job: Job): Promise<JudgeRead> {
  const order = candidates.map((c) => c.partner.id);
  let adjustments: JudgeLLMOut["adjustments"] = [];
  let rationale = "";
  try {
    const raw = await chat({
      model: resolveModel(judge.model),
      system: judgeSystemPrompt(judge),
      user: judgeUserPrompt(job, candidates),
      temperature: 0,
      json: true,
    });
    const out = parseJson<JudgeLLMOut>(raw);
    adjustments = out.adjustments ?? [];
    rationale = out.rationale ?? "";
  } catch {
    rationale = `${judge.name}: scored on base sub-scores (evidence-read unavailable).`;
  }

  const adjById = new Map(adjustments.map((a) => [a.id, a]));
  const scores: Record<string, number> = {};
  let evidenceAdjustment: string | undefined;
  for (const c of candidates) {
    const adj = adjById.get(c.partner.id);
    const sub: SubScores = { ...c.subScores };
    if (adj?.fit != null) sub.fit = clamp01(adj.fit);
    if (adj?.customerExperience != null) sub.customerExperience = clamp01(adj.customerExperience);
    if (adj?.note && !evidenceAdjustment) evidenceAdjustment = `${c.partner.name}: ${adj.note}`;
    scores[c.partner.id] = judgeScore(sub, judge.weights);
  }
  const preference = order.map((id) => scores[id]);
  const topCandidateId = order.reduce((a, b) => (scores[b] > scores[a] ? b : a), order[0]);
  return {
    judgeId: judge.id,
    judgeName: judge.name,
    modelFamily: judge.modelFamily,
    scores,
    preference,
    topCandidateId,
    rationale,
    evidenceAdjustment,
  };
}

// Run the whole committee: judges in parallel (independent commit), then gate.
export async function runCommittee(
  judges: Judge[],
  candidates: Candidate[],
  job: Job,
  minAgreement: number,
  onRead?: (read: JudgeRead) => void,
): Promise<CommitteeResult> {
  const order = candidates.map((c) => c.partner.id);
  const reads = await Promise.all(
    judges.map(async (j) => {
      const r = await runJudge(j, candidates, job);
      onRead?.(r);
      return r;
    }),
  );
  return gate({ candidateOrder: order, reads, minAgreement });
}

// Deterministic committee (no LLM): each judge scores purely on the pre-computed
// sub-scores. Used for keyless/offline runs and to prove scenario behavior in tests.
export function deterministicRead(judge: Judge, candidates: Candidate[], order: string[]): JudgeRead {
  const scores: Record<string, number> = {};
  for (const c of candidates) scores[c.partner.id] = judgeScore(c.subScores, judge.weights);
  const preference = order.map((id) => scores[id]);
  const topCandidateId = order.reduce((a, b) => (scores[b] > scores[a] ? b : a), order[0]);
  return {
    judgeId: judge.id,
    judgeName: judge.name,
    modelFamily: judge.modelFamily,
    scores,
    preference,
    topCandidateId,
    rationale: `${judge.name}: scored on base sub-scores.`,
  };
}

export function runCommitteeDeterministic(
  judges: Judge[],
  candidates: Candidate[],
  minAgreement: number,
): CommitteeResult {
  const order = candidates.map((c) => c.partner.id);
  const reads = judges.map((j) => deterministicRead(j, candidates, order));
  return gate({ candidateOrder: order, reads, minAgreement });
}

export type { Criterion };
