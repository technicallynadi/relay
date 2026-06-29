import type { Trade, TradeAdjacency } from "@/lib/types";

// Directed cross-trade edges: a completed job in `fromTrade` may imply a `toTrade`
// referral. Weight = base strength of the signal; the Detector still needs the job's
// tech notes to actually fire. This is the curated adjacency layer of the graph.
export const ADJACENCY: TradeAdjacency[] = [
  { fromTrade: "plumbing", toTrade: "restoration", weight: 0.9, rationale: "Leaks and burst pipes cause water damage that needs drying and mold remediation." },
  { fromTrade: "restoration", toTrade: "cleaning", weight: 0.4, rationale: "After water/fire mitigation, homes often need a deep clean." },
  { fromTrade: "cleaning", toTrade: "restoration", weight: 0.5, rationale: "Cleaners are first to spot water stains, mold, and damage." },
  { fromTrade: "hvac", toTrade: "electrical", weight: 0.7, rationale: "HVAC loads and aging panels surface electrical hazards." },
  { fromTrade: "electrical", toTrade: "hvac", weight: 0.5, rationale: "Electrical work on condensers and thermostats reveals HVAC issues." },
  { fromTrade: "appliance", toTrade: "plumbing", weight: 0.6, rationale: "Dishwashers, washers, and ice makers tie into supply and drain lines." },
  { fromTrade: "appliance", toTrade: "electrical", weight: 0.55, rationale: "Failing appliances expose circuit and outlet problems." },
  { fromTrade: "appliance", toTrade: "dryer_vent", weight: 0.65, rationale: "Dryer service reveals clogged, hazardous vents." },
  { fromTrade: "cleaning", toTrade: "dryer_vent", weight: 0.5, rationale: "Cleaning crews notice lint-packed dryer vents (a fire risk)." },
  { fromTrade: "inspection", toTrade: "plumbing", weight: 0.5, rationale: "Inspections flag plumbing defects." },
  { fromTrade: "inspection", toTrade: "electrical", weight: 0.5, rationale: "Inspections flag electrical defects." },
  { fromTrade: "inspection", toTrade: "restoration", weight: 0.5, rationale: "Inspections uncover existing water/mold damage." },
  { fromTrade: "inspection", toTrade: "hvac", weight: 0.45, rationale: "Inspections flag failing HVAC systems." },
  { fromTrade: "glass", toTrade: "restoration", weight: 0.4, rationale: "Broken glass often accompanies storm/water intrusion." },
  { fromTrade: "landscaping", toTrade: "pest", weight: 0.45, rationale: "Overgrowth and standing water drive pest problems." },
];

const OUT = new Map<Trade, TradeAdjacency[]>();
for (const e of ADJACENCY) {
  const list = OUT.get(e.fromTrade) ?? [];
  list.push(e);
  OUT.set(e.fromTrade, list);
}

export function adjacentTrades(from: Trade): TradeAdjacency[] {
  return (OUT.get(from) ?? []).slice().sort((a, b) => b.weight - a.weight);
}
