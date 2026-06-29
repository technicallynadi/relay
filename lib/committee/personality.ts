import { CRITERIA, type Criterion, type OceanVector, type Weights } from "@/lib/types";

// Documented OCEAN -> criteria-weights prior (see docs/research/...judge-panel...).
// Personality traits INITIALIZE and JUSTIFY each judge's weights; they are never
// role-played in a prompt. Grounded in the Big Five -> decision-style directions:
//   C -> reliability / capacity (and risk-aversion)
//   O -> novel/strong fit, exploration (lowers in-network bias)
//   E -> approach / reward-seeking -> conversion
//   A -> cooperation / customer orientation
//   N -> loss-aversion -> downside avoidance (capacity, safe in-network choice)
export function oceanToWeights(o: OceanVector): Weights {
  const c01 = (x: number) => Math.max(0, Math.min(1, x));
  return {
    fit: c01(0.3 + 0.6 * o.O),
    capacity: c01(0.2 + 0.5 * o.C + 0.3 * o.N),
    proximity: c01(0.25 + 0.3 * o.A),
    conversion: c01(0.15 + 0.7 * o.E),
    inNetwork: c01(0.1 + 0.6 * o.N + 0.45 * (1 - o.O)),
    customerExperience: c01(0.15 + 0.7 * o.A),
  };
}

export function topCriterion(w: Weights): Criterion {
  return CRITERIA.reduce((a, b) => (w[b] > w[a] ? b : a), CRITERIA[0]);
}

export const CRITERION_LABEL: Record<Criterion, string> = {
  fit: "capability fit",
  capacity: "capacity & reliability",
  proximity: "proximity to the customer",
  conversion: "conversion likelihood",
  inNetwork: "in-network / brand trust",
  customerExperience: "customer experience",
};
