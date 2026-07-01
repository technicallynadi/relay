import { describe, expect, test } from "bun:test";
import { JOB_BY_SCENARIO } from "@/data/jobs";
import { JUDGES } from "@/data/judges";
import { PARTNERS } from "@/data/partners";
import { runCommitteeDeterministic } from "@/lib/committee";
import { buildCandidates } from "@/lib/retrieval";

const MIN_AGREEMENT = 0.6;

describe("the demo scenarios behave from the deterministic sub-scores + Kendall's W jury", () => {
  test("'fires': Rainbow dominates → the jury agrees → auto-route eligible", () => {
    const job = JOB_BY_SCENARIO.get("drain-job")!;
    const candidates = buildCandidates(PARTNERS, job, "restoration");
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const r = runCommitteeDeterministic(JUDGES, candidates, MIN_AGREEMENT);
    expect(r.decision).toBe("auto_route_eligible");
    expect(r.converged).toBe(true);
    expect(r.consensusPartnerId).toBe("p_rainbow_plano");
    expect(r.concordance).toBeGreaterThanOrEqual(MIN_AGREEMENT);
  });

  test("'escalates': Mr. Electric vs Volt is a real trade-off → the jury splits → escalate", () => {
    const job = JOB_BY_SCENARIO.get("ac-tuneup")!;
    const candidates = buildCandidates(PARTNERS, job, "electrical");
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const r = runCommitteeDeterministic(JUDGES, candidates, MIN_AGREEMENT);
    expect(r.decision).toBe("escalated");
    expect(r.converged).toBe(false);
    expect(r.consensusPartnerId).toBeNull();
    expect(r.split).toBeDefined();
  });
});
