// Synthesizes plausible completed-job "signals" for the worker to pull off the queue.
// ~72% carry a cross-trade opportunity (a tech note containing the target trade's
// keywords, so the detector fires); the rest are clean jobs that decline. Lightweight —
// no DB, no LLM — so the worker process stays cheap.

import { adjacentTrades } from "@/data/adjacency";
import { BRANDS } from "@/data/brands";
import type { Job, Trade } from "@/lib/types";

// Signal phrases per TARGET trade — each contains the keywords the detector looks for.
const SIGNAL: Partial<Record<Trade, string[]>> = {
  restoration: [
    "there's standing water under the cabinet and a musty smell starting — looks like moisture got in.",
    "flagged a slow leak that's been saturating the drywall, with some damp and early mold.",
  ],
  electrical: [
    "the electrical panel was warm to the touch and a breaker looked scorched — needs an electrician.",
    "the wiring at the outlet was arcing and the panel is an older model running hot.",
  ],
  hvac: [
    "the furnace and ducting looked like they were struggling and the condenser is short-cycling.",
    "the thermostat and refrigerant were off — the whole heating-and-cooling system needs a look.",
  ],
  plumbing: [
    "a supply line behind the unit is seeping and the drain was running slow.",
    "the shutoff valve was corroded and a pipe joint looked like it's about to let go.",
  ],
  dryer_vent: [
    "the dryer vent was packed with lint and the wall was warm — a real fire risk.",
    "the vent ducting was clogged with lint; it should be cleaned before it becomes a hazard.",
  ],
  pest: [
    "saw signs of rodent activity and an ant trail around the foundation.",
    "standing water and overgrowth are drawing pests — a mosquito and termite risk.",
  ],
  cleaning: ["a lot of dust and debris was left behind that could use a deep clean."],
};

const SUMMARY: Partial<Record<Trade, string[]>> = {
  plumbing: ["Cleared a drain blockage", "Fixed a supply-line leak", "Swapped a water heater"],
  hvac: ["Completed an AC tune-up", "Repaired the furnace", "Replaced the condenser"],
  electrical: ["Upgraded a breaker panel", "Installed new outlets", "Fixed a lighting circuit"],
  appliance: ["Installed a dishwasher", "Repaired a washer", "Fixed an ice maker"],
  inspection: ["Completed a pre-listing inspection", "Ran a move-in inspection"],
  cleaning: ["Finished a whole-home deep clean", "Completed a move-out clean"],
  restoration: ["Wrapped a water-mitigation job", "Finished a mold remediation"],
  dryer_vent: ["Cleaned a dryer vent"],
  handyman: ["Mounted shelving and a TV bracket", "Assembled furniture"],
  landscaping: ["Completed a yard cleanup", "Trimmed and mulched the beds"],
  glass: ["Replaced a broken window", "Repaired a patio door"],
};

const LOCATIONS = [
  { label: "Plano, TX", lat: 33.0198, lng: -96.6989 },
  { label: "Frisco, TX", lat: 33.1507, lng: -96.8236 },
  { label: "Allen, TX", lat: 33.1032, lng: -96.6706 },
  { label: "McKinney, TX", lat: 33.1972, lng: -96.6398 },
];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

let counter = 0;

export function generateJob(): Job {
  const brand = pick(BRANDS);
  const trade = brand.trade;
  const loc = pick(LOCATIONS);
  const summary = pick(SUMMARY[trade] ?? ["Completed a job"]);
  const edges = adjacentTrades(trade);
  const id = `job_gen_${Date.now()}_${counter++}`;
  const common = { id, scenarioKey: "generated", brandId: brand.id, trade, location: loc, summary };

  // ~28% clean jobs (no cross-trade signal → declines).
  if (edges.length === 0 || Math.random() < 0.28) {
    return {
      ...common,
      techNotes: `${summary}. Clean job — everything checked out, nothing else flagged.`,
      neededSpecialties: [],
    };
  }

  // Pick a strong adjacency (top 1-2 by weight) and one of its signal phrases.
  const edge = edges[Math.floor(Math.random() * Math.min(edges.length, 2))];
  const signal = pick(SIGNAL[edge.toTrade] ?? ["something worth a second look."]);
  return { ...common, techNotes: `${summary}. ${cap(signal)}`, neededSpecialties: [] };
}
