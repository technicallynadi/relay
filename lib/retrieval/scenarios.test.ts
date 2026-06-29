import { describe, expect, test } from "bun:test";
import { JOB_BY_SCENARIO } from "@/data/jobs";
import { JUDGES } from "@/data/judges";
import { PARTNERS } from "@/data/partners";
import { runCommitteeDeterministic } from "@/lib/committee";
import { buildCandidates } from "@/lib/retrieval";

const EPSILON = 0.15;

describe("the three demo scenarios behave from the deterministic sub-scores + δ<ε math", () => {
  test("'fires': Rainbow dominates → committee converges → auto-route eligible", () => {
    const job = JOB_BY_SCENARIO.get("drain-job")!;
    const candidates = buildCandidates(PARTNERS, job, "restoration");
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const r = runCommitteeDeterministic(JUDGES, candidates, EPSILON);
    expect(r.decision).toBe("auto_route_eligible");
    expect(r.converged).toBe(true);
    expect(r.consensusPartnerId).toBe("p_rainbow_plano");
    expect(r.deltaMax).toBeLessThan(EPSILON);
  });

  test("'abstains': Mr. Electric vs Volt is a real trade-off → judges split → escalate", () => {
    const job = JOB_BY_SCENARIO.get("ac-tuneup")!;
    const candidates = buildCandidates(PARTNERS, job, "electrical");
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    const r = runCommitteeDeterministic(JUDGES, candidates, EPSILON);
    expect(r.decision).toBe("escalated");
    expect(r.converged).toBe(false);
    expect(r.consensusPartnerId).toBeNull();
    expect(r.split).toBeDefined();
    expect(r.deltaMax).toBeGreaterThanOrEqual(EPSILON);
  });

  test("the ε knob can force the split scenario to auto-route if opened wide", () => {
    const job = JOB_BY_SCENARIO.get("ac-tuneup")!;
    const candidates = buildCandidates(PARTNERS, job, "electrical");
    const wide = runCommitteeDeterministic(JUDGES, candidates, 0.99);
    expect(wide.decision).toBe("auto_route_eligible");
  });
});
