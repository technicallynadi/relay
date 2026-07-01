// The pipeline orchestrator: Detector → Retriever → Committee → Composer, emitting
// streamed RunEvents. Uses the LLM when a key is present and degrades to deterministic
// behavior otherwise — the demo arc holds either way.

import { adjacentTrades } from "@/data/adjacency";
import { JOB_BY_SCENARIO } from "@/data/jobs";
import { JUDGES } from "@/data/judges";
import { getPartners } from "@/lib/places";
import { gate, runJudge } from "@/lib/committee";
import { beginCostCapture, endCostCapture } from "@/lib/cost";
import { chatStream, resolveModel } from "@/lib/models";
import { haversineMiles, retrieveCandidates } from "@/lib/retrieval";
import { createReferral } from "@/lib/store";
import type { Detection, Handoff, Job, JudgeRead, Partner, RunEvent, Trade } from "@/lib/types";

const TRADE_KEYWORDS: Partial<Record<Trade, string[]>> = {
  restoration: ["water", "leak", "flood", "mold", "musty", "damp", "saturat", "moisture"],
  electrical: ["electrical", "panel", "breaker", "wiring", "outlet", "voltage", "spark"],
  hvac: ["hvac", "furnace", "duct", "thermostat", "condenser", "refriger"],
  plumbing: ["plumb", "pipe", "drain", "faucet", "sewer", "supply line"],
  dryer_vent: ["dryer", "lint", "vent"],
  pest: ["pest", "mosquito", "ant", "rodent", "termite", "roach"],
  cleaning: ["dusty", "debris", "soot"],
};

const SIGNAL_PHRASE: Partial<Record<Trade, string>> = {
  restoration: "water had worked into the cabinet under the sink and it was starting to smell musty",
  electrical: "the electrical panel feeding the system was running hot",
  hvac: "the heating-and-cooling system looked like it was struggling",
  plumbing: "a plumbing line nearby looked like it was seeping",
  dryer_vent: "the dryer vent was packed with lint — a real fire risk",
};

// Deterministic detection: walk the brand-capability subgraph for the job's trade and
// confirm the adjacent trade is actually signalled in the tech notes.
export function detect(job: Job): Detection {
  const notes = job.techNotes.toLowerCase();
  for (const edge of adjacentTrades(job.trade)) {
    const kws = TRADE_KEYWORDS[edge.toTrade] ?? [];
    if (kws.some((k) => notes.includes(k))) {
      return {
        hasReferral: true,
        trade: edge.toTrade,
        signal: `${edge.toTrade} signal found in a completed ${job.trade} job`,
        rationale: edge.rationale,
      };
    }
  }
  return {
    hasReferral: false,
    trade: null,
    signal: "No cross-trade signal in this job",
    rationale: "The completed work is self-contained — nothing adjacent was flagged.",
  };
}

function composeTemplate(job: Job, partner: Partner, detection: Detection): Handoff {
  const dist = haversineMiles(job.location.lat, job.location.lng, partner.lat, partner.lng).toFixed(1);
  const net = partner.brandId ? "a trusted Neighborly partner" : "a well-reviewed local partner";
  const phrase = (detection.trade && SIGNAL_PHRASE[detection.trade]) || "something worth a second look";
  const customerMessage =
    `Hi — while we were taking care of your job today, our technician noticed ${phrase}. ` +
    `With your okay, I've asked ${partner.name}, ${net} about ${dist} miles away, to reach out and take a look. ` +
    `No obligation at all — we'd just rather you have it handled before it becomes a bigger problem.`;
  const internalNote =
    `Referral from ${job.brandId} → ${partner.name} (${detection.trade}). ` +
    `Basis: ${detection.rationale}`;
  return { customerMessage, internalNote };
}

const COMPOSER_SYSTEM =
  "You are a concierge writing a brief, warm referral note from a home-services brand to a customer. " +
  "No hard sell, no jargon, no exclamation marks, no emojis. Two or three sentences. Mention the partner by " +
  "name, note it is the customer's choice, and keep it calm and reassuring.";

function composerUser(job: Job, partner: Partner, detection: Detection): string {
  const dist = haversineMiles(job.location.lat, job.location.lng, partner.lat, partner.lng).toFixed(1);
  return [
    `Completed job: ${job.summary}.`,
    `What the tech noticed: ${job.techNotes}`,
    `Referring to: ${partner.name} (${partner.brandId ? "in-network Neighborly partner" : "trusted local partner"}, about ${dist} miles away).`,
    `Write the customer-facing note.`,
  ].join("\n");
}

// Small async queue so judges can run in parallel (independent "commit") yet stream to
// the UI as each one resolves.
function makeQueue<T>() {
  const items: T[] = [];
  let notify: (() => void) | null = null;
  return {
    push(x: T) {
      items.push(x);
      const n = notify;
      notify = null;
      n?.();
    },
    async *drain(expected: number): AsyncGenerator<T> {
      let count = 0;
      while (count < expected) {
        if (items.length) {
          yield items.shift() as T;
          count++;
        } else {
          await new Promise<void>((res) => {
            notify = res;
          });
        }
      }
    },
  };
}

export interface PipelineOpts {
  minAgreement?: number;
}

export async function* runPipeline(scenarioKey: string, opts: PipelineOpts = {}): AsyncGenerator<RunEvent> {
  const job = JOB_BY_SCENARIO.get(scenarioKey);
  if (!job) {
    yield { type: "error", message: `Unknown scenario "${scenarioKey}"` };
    return;
  }
  yield* runPipelineForJob(job, opts);
}

// Run the full pipeline on any job — a seeded scenario or a job composed on the spot.
export async function* runPipelineForJob(job: Job, opts: PipelineOpts = {}): AsyncGenerator<RunEvent> {
  const minAgreement = opts.minAgreement ?? (Number(process.env.MIN_AGREEMENT) || 0.6);
  beginCostCapture();
  yield { type: "job", job };

  // 1. Opportunity Detector
  yield { type: "stage", stage: "detector", status: "start" };
  const detection = detect(job);
  yield { type: "detection", detection };
  yield { type: "stage", stage: "detector", status: "done" };

  if (!detection.hasReferral || !detection.trade) {
    const ref = createReferral({
      jobId: job.id,
      detectedTrade: null,
      candidateIds: [],
      committee: null,
      decision: "declined",
      humanAction: null,
      draftedMessage: null,
      outcome: null,
    });
    yield { type: "cost", summary: endCostCapture() };
    yield { type: "done", referralId: ref.id, decision: "declined" };
    return;
  }

  // 2. Partner Retriever
  yield { type: "stage", stage: "retriever", status: "start" };
  const partners = await getPartners(detection.trade, job.location);
  const candidates = await retrieveCandidates(partners, job, detection.trade);
  yield { type: "candidates", candidates };
  yield { type: "stage", stage: "retriever", status: "done" };

  // 3. Routing Validator (the jury)
  yield { type: "stage", stage: "committee", status: "start" };
  const order = candidates.map((c) => c.partner.id);
  const q = makeQueue<JudgeRead>();
  const all = Promise.all(
    JUDGES.map((j) =>
      runJudge(j, candidates, job).then((r) => {
        q.push(r);
        return r;
      }),
    ),
  );
  for await (const read of q.drain(JUDGES.length)) {
    yield { type: "judge_read", read };
  }
  const reads = await all;
  const result = gate({ candidateOrder: order, reads, minAgreement });
  yield { type: "committee", result };
  yield { type: "stage", stage: "committee", status: "done" };

  // 4. Handoff Composer
  yield { type: "stage", stage: "composer", status: "start" };
  const chosenId = result.consensusPartnerId ?? result.split?.partnerAId ?? order[0];
  const chosen = candidates.find((c) => c.partner.id === chosenId)?.partner ?? candidates[0].partner;
  const template = composeTemplate(job, chosen, detection);
  let customerMessage = template.customerMessage;
  try {
    let acc = "";
    for await (const tok of chatStream({
      model: resolveModel(process.env.COMPOSER_MODEL || "openai/gpt-4o-mini"),
      system: COMPOSER_SYSTEM,
      user: composerUser(job, chosen, detection),
      temperature: 0.4,
    })) {
      acc += tok;
      yield { type: "token", stage: "composer", text: tok };
    }
    if (acc.trim()) customerMessage = acc.trim();
  } catch {
    // No key / error: stream the deterministic template so the UI still animates.
    for (const chunk of template.customerMessage.match(/.{1,20}/g) ?? []) {
      yield { type: "token", stage: "composer", text: chunk };
    }
  }
  const handoff: Handoff = { customerMessage, internalNote: template.internalNote };
  yield { type: "handoff", handoff };
  yield { type: "stage", stage: "composer", status: "done" };

  const ref = createReferral({
    jobId: job.id,
    detectedTrade: detection.trade,
    candidateIds: order,
    committee: result,
    decision: result.decision,
    humanAction: null,
    draftedMessage: customerMessage,
    outcome: null,
  });
  yield { type: "cost", summary: endCostCapture() };
  yield { type: "done", referralId: ref.id, decision: result.decision };
}
