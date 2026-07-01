import { describe, expect, test } from "bun:test";
import { gate, judgeScore } from "@/lib/committee";
import { oceanToWeights, topCriterion } from "@/lib/committee/personality";
import type { JudgeRead, OceanVector, Weights } from "@/lib/types";

describe("oceanToWeights — each archetype lands on its intended lens", () => {
  const cases: Array<[string, OceanVector, string]> = [
    ["Matchmaker", { O: 0.85, C: 0.55, E: 0.45, A: 0.4, N: 0.3 }, "fit"],
    ["Operator", { O: 0.25, C: 0.9, E: 0.4, A: 0.45, N: 0.65 }, "capacity"],
    ["Closer", { O: 0.55, C: 0.35, E: 0.85, A: 0.45, N: 0.2 }, "conversion"],
    ["Concierge", { O: 0.55, C: 0.5, E: 0.5, A: 0.9, N: 0.45 }, "customerExperience"],
    ["Steward", { O: 0.2, C: 0.8, E: 0.35, A: 0.55, N: 0.75 }, "inNetwork"],
  ];
  for (const [name, ocean, expected] of cases) {
    test(`${name} over-weights ${expected}`, () => {
      expect(topCriterion(oceanToWeights(ocean))).toBe(expected as never);
    });
  }
});

test("judgeScore is a normalized weighted mean of sub-scores", () => {
  const w: Weights = { fit: 1, capacity: 0, proximity: 0, conversion: 0, inNetwork: 0, customerExperience: 0 };
  const sub = { fit: 0.8, capacity: 0.1, proximity: 0.1, conversion: 0.1, inNetwork: 0.1, customerExperience: 0.1 };
  expect(judgeScore(sub, w)).toBeCloseTo(0.8, 5);
});

function mkRead(name: string, scores: Record<string, number>, order: string[]): JudgeRead {
  const preference = order.map((id) => scores[id]);
  const top = order.reduce((a, b) => (scores[b] > scores[a] ? b : a), order[0]);
  return { judgeId: name, judgeName: name, modelFamily: "test", scores, preference, topCandidateId: top, rationale: "" };
}

describe("gate — Kendall's W concordance decides auto-route vs escalate", () => {
  const order = ["a", "b"];

  test("unanimous jury → auto_route_eligible with a Borda consensus winner", () => {
    const reads = [
      mkRead("j1", { a: 0.9, b: 0.4 }, order),
      mkRead("j2", { a: 0.85, b: 0.45 }, order),
      mkRead("j3", { a: 0.88, b: 0.42 }, order),
    ];
    const r = gate({ candidateOrder: order, reads, minAgreement: 0.6 });
    expect(r.converged).toBe(true);
    expect(r.decision).toBe("auto_route_eligible");
    expect(r.consensusPartnerId).toBe("a");
    expect(r.concordance).toBeGreaterThanOrEqual(0.6);
  });

  test("split jury → escalated, no consensus, surfaces the contested pair", () => {
    const reads = [
      mkRead("j1", { a: 0.9, b: 0.3 }, order),
      mkRead("j2", { a: 0.3, b: 0.9 }, order),
      mkRead("j3", { a: 0.85, b: 0.35 }, order),
    ];
    const r = gate({ candidateOrder: order, reads, minAgreement: 0.6 });
    expect(r.converged).toBe(false);
    expect(r.decision).toBe("escalated");
    expect(r.consensusPartnerId).toBeNull();
    expect(r.concordance).toBeLessThan(0.6);
    expect(r.split).toBeDefined();
    expect([r.split?.partnerAId, r.split?.partnerBId].sort()).toEqual(["a", "b"]);
  });

  test("the required-agreement threshold flips a partial-agreement ranking", () => {
    const order3 = ["a", "b", "c"];
    const reads = [
      mkRead("j1", { a: 0.9, b: 0.5, c: 0.4 }, order3),
      mkRead("j2", { a: 0.5, b: 0.9, c: 0.4 }, order3),
      mkRead("j3", { a: 0.85, b: 0.55, c: 0.4 }, order3),
    ];
    const lenient = gate({ candidateOrder: order3, reads, minAgreement: 0.2 });
    const strict = gate({ candidateOrder: order3, reads, minAgreement: 0.95 });
    expect(lenient.decision).toBe("auto_route_eligible");
    expect(strict.decision).toBe("escalated");
    expect(lenient.concordance).toBeGreaterThan(0.2);
    expect(lenient.concordance).toBeLessThan(0.95);
  });
});
