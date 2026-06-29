// The CRPC-style committee: diverse judges score the candidates independently
// (commit), reveal preference vectors, and we gate the routing on whether they
// converge (pairwise δ < ε). Adapted from Tim Cotten's Commit-Reveal Pairwise
// Comparison Protocol — eval core lifted out of the trustless setting.

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

function mean(v: number[]): number {
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

// Correlation = cosine of mean-centered vectors. Sensitive to how judges RANK the
// candidates rather than to overall score level — two judges who both score everyone
// ~0.7 but flip the winner are correctly seen as disagreeing.
function correlation(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i] - ma;
    const cb = b[i] - mb;
    dot += ca * cb;
    na += ca * ca;
    nb += cb * cb;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 1; // a flat (indifferent) judge agrees with everyone
}

// Pairwise δ = (1 − correlation(Φᵢ, Φⱼ)) / 2 ∈ [0,1]: ranking disagreement between two
// judges. 0 = identical ranking, 1 = perfectly inverted. The ranking-sensitive form of
// CRPC's cosine δ.
export function computeDeltaMatrix(reads: JudgeRead[]): number[][] {
  const n = reads.length;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = (1 - correlation(reads[i].preference, reads[j].preference)) / 2;
      m[i][j] = d;
      m[j][i] = d;
    }
  }
  return m;
}

export interface GateInput {
  candidateOrder: string[];
  reads: JudgeRead[];
  epsilon: number;
  noiseFloor?: number;
}

// The δ<ε gate. Pure: given judge reads, decide auto-route vs escalate.
export function gate({ candidateOrder, reads, epsilon, noiseFloor = 0.02 }: GateInput): CommitteeResult {
  const deltaMatrix = computeDeltaMatrix(reads);
  let deltaMax = 0;
  let sum = 0;
  let pairs = 0;
  let maxI = 0;
  let maxJ = reads.length > 1 ? 1 : 0;
  for (let i = 0; i < reads.length; i++) {
    for (let j = i + 1; j < reads.length; j++) {
      const d = deltaMatrix[i][j];
      sum += d;
      pairs++;
      if (d > deltaMax) {
        deltaMax = d;
        maxI = i;
        maxJ = j;
      }
    }
  }
  const deltaMean = pairs ? sum / pairs : 0;
  const converged = deltaMax < epsilon;

  const meanScore: Record<string, number> = {};
  for (const id of candidateOrder) {
    meanScore[id] = reads.reduce((s, r) => s + (r.scores[id] ?? 0), 0) / (reads.length || 1);
  }
  const consensusPartnerId = candidateOrder.length
    ? candidateOrder.reduce((a, b) => (meanScore[b] > meanScore[a] ? b : a))
    : null;

  const base = {
    candidateOrder,
    reads,
    deltaMatrix,
    deltaMax,
    deltaMean,
    epsilon,
    noiseFloor,
  };

  if (converged) {
    return { ...base, converged: true, consensusPartnerId, decision: "auto_route_eligible" };
  }
  const a = reads[maxI];
  const b = reads[maxJ];
  return {
    ...base,
    converged: false,
    consensusPartnerId: null,
    decision: "escalated",
    split: {
      partnerAId: a.topCandidateId,
      partnerBId: b.topCandidateId,
      note: `${a.judgeName} and ${b.judgeName} favor different partners (δ=${deltaMax.toFixed(2)} ≥ ε=${epsilon.toFixed(2)}). Human decides.`,
    },
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
  epsilon: number,
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
  return gate({ candidateOrder: order, reads, epsilon });
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
  epsilon: number,
): CommitteeResult {
  const order = candidates.map((c) => c.partner.id);
  const reads = judges.map((j) => deterministicRead(j, candidates, order));
  return gate({ candidateOrder: order, reads, epsilon });
}

export type { Criterion };
