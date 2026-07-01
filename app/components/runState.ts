// The observatory's run state: a typed accumulator over the RunEvent stream.
// page.tsx folds each arriving event into this object; every panel renders from it.
// Intentionally generic over the event union — no scenario hard-codes a fixed
// sequence, so "declines" (ends after detection) and "abstains" (adds a split)
// fall out naturally.

import type { CostSummary } from "@/lib/cost";
import type {
  Candidate,
  CommitteeResult,
  Decision,
  Detection,
  Handoff,
  Job,
  JudgeRead,
  PipelineStage,
  RunEvent,
} from "@/lib/types";

export type StageStatus = "queued" | "live" | "done" | "skipped";
export type RunPhase = "idle" | "running" | "complete" | "error";
export type HumanAction = "send" | "edit" | "skip";
export type Outcome = "accepted" | "closed" | "declined";

export const PIPELINE_STAGES: PipelineStage[] = [
  "detector",
  "retriever",
  "committee",
  "composer",
];

export const STAGE_META: Record<
  PipelineStage,
  { label: string; blurb: string }
> = {
  detector: { label: "Opportunity Detector", blurb: "Cross-trade signal?" },
  retriever: { label: "Partner Retriever", blurb: "Federated candidates" },
  committee: { label: "Jury", blurb: "Kendall's W agreement gate" },
  composer: { label: "Handoff Composer", blurb: "Customer message" },
};

export interface RunState {
  phase: RunPhase;
  job: Job | null;
  stages: Record<PipelineStage, StageStatus>;
  tokens: Record<PipelineStage, string>;
  detection: Detection | null;
  candidates: Candidate[];
  reads: JudgeRead[];
  committee: CommitteeResult | null;
  handoff: Handoff | null;
  referralId: string | null;
  decision: Decision | null;
  error: string | null;
  // human gate result (client-side, set after POST /api/action)
  humanAction: HumanAction | null;
  outcome: Outcome | null;
  // LLM cost for this run (null until the cost event arrives; zero in deterministic mode)
  cost: CostSummary | null;
}

export function emptyRun(phase: RunPhase = "idle"): RunState {
  return {
    phase,
    job: null,
    stages: {
      detector: "queued",
      retriever: "queued",
      committee: "queued",
      composer: "queued",
    },
    tokens: { detector: "", retriever: "", committee: "", composer: "" },
    detection: null,
    candidates: [],
    reads: [],
    committee: null,
    handoff: null,
    referralId: null,
    decision: null,
    error: null,
    humanAction: null,
    outcome: null,
    cost: null,
  };
}

// Fold one streamed event into the run state (immutably).
export function reduceEvent(prev: RunState, ev: RunEvent): RunState {
  switch (ev.type) {
    case "job":
      return { ...prev, job: ev.job };

    case "stage": {
      const stages = { ...prev.stages };
      if (ev.status === "start") stages[ev.stage] = "live";
      else stages[ev.stage] = "done";
      return { ...prev, stages };
    }

    case "token": {
      const tokens = { ...prev.tokens };
      tokens[ev.stage] = (tokens[ev.stage] ?? "") + ev.text;
      return { ...prev, tokens };
    }

    case "detection":
      return { ...prev, detection: ev.detection };

    case "candidates":
      return { ...prev, candidates: ev.candidates };

    case "judge_read": {
      // de-dupe by judgeId in case of replay
      const others = prev.reads.filter((r) => r.judgeId !== ev.read.judgeId);
      return { ...prev, reads: [...others, ev.read] };
    }

    case "committee":
      // The committee result carries the canonical reads too — prefer them.
      return {
        ...prev,
        committee: ev.result,
        reads: ev.result.reads.length ? ev.result.reads : prev.reads,
      };

    case "handoff":
      return { ...prev, handoff: ev.handoff };

    case "done": {
      // Any stage still queued at completion was not reached (e.g. declines):
      // mark queued→skipped so the strip reads honestly.
      const stages = { ...prev.stages };
      for (const s of PIPELINE_STAGES) {
        if (stages[s] === "queued") stages[s] = "skipped";
      }
      return {
        ...prev,
        phase: "complete",
        stages,
        referralId: ev.referralId,
        decision: ev.decision,
      };
    }

    case "cost":
      return { ...prev, cost: ev.summary };

    case "error":
      return { ...prev, phase: "error", error: ev.message };

    default:
      return prev;
  }
}

// The two partners under contention when the committee splits (for highlighting).
export function disputedPartnerIds(state: RunState): Set<string> {
  const set = new Set<string>();
  const split = state.committee?.split;
  if (split) {
    set.add(split.partnerAId);
    set.add(split.partnerBId);
  }
  return set;
}

export function tradeLabel(trade: string | null | undefined): string {
  if (!trade) return "—";
  return trade.replace(/_/g, " ");
}

export function decisionBadge(decision: Decision | null): {
  text: string;
  tone: "teal" | "amber" | "muted";
} {
  switch (decision) {
    case "auto_route_eligible":
      return { text: "Auto-route eligible", tone: "teal" };
    case "escalated":
      return { text: "Escalated to human", tone: "amber" };
    case "declined":
      return { text: "Declined — no referral", tone: "muted" };
    default:
      return { text: "Pending", tone: "muted" };
  }
}
