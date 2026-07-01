import type { Judge, OceanVector } from "@/lib/types";
import { oceanToWeights } from "@/lib/committee/personality";

// The committee panel. Each judge is a distinct evaluation lens; its OCEAN vector is a
// DOCUMENTED PRIOR that derives the criteria weights (never role-played in the prompt).
// Models deliberately span families — cross-family diversity is the evidence-backed
// source of useful disagreement. Model ids are OpenRouter slugs (the defaults); override any
// judge's model per-id in relay.config.yaml (see lib/judges.ts).
interface JudgeDef {
  id: string;
  name: string;
  role: string;
  ocean: OceanVector;
  modelFamily: string;
  model: string;
}

const DEFS: JudgeDef[] = [
  {
    id: "matchmaker",
    name: "The Matchmaker",
    role: "find the best technical fit for the job, even out-of-network",
    ocean: { O: 0.85, C: 0.55, E: 0.45, A: 0.4, N: 0.3 },
    modelFamily: "openai",
    model: "openai/gpt-4o-mini",
  },
  {
    id: "operator",
    name: "The Operator",
    role: "insist the partner can actually deliver — capacity and reliability",
    ocean: { O: 0.25, C: 0.9, E: 0.4, A: 0.45, N: 0.65 },
    modelFamily: "anthropic",
    model: "anthropic/claude-haiku-4.5",
  },
  {
    id: "closer",
    name: "The Closer",
    role: "maximize the odds the referral converts to a booked job",
    ocean: { O: 0.55, C: 0.35, E: 0.85, A: 0.45, N: 0.2 },
    modelFamily: "meta",
    model: "meta-llama/llama-3.1-70b-instruct",
  },
  {
    id: "concierge",
    name: "The Concierge",
    role: "protect the customer's experience and the relationship",
    ocean: { O: 0.55, C: 0.5, E: 0.5, A: 0.9, N: 0.45 },
    modelFamily: "anthropic",
    model: "anthropic/claude-sonnet-4.6",
  },
  {
    id: "steward",
    name: "The Steward",
    role: "defend in-network brand standards and low-risk choices",
    ocean: { O: 0.2, C: 0.8, E: 0.35, A: 0.55, N: 0.75 },
    modelFamily: "google",
    model: "google/gemini-2.5-flash",
  },
];

export const JUDGES: Judge[] = DEFS.map((d) => ({
  ...d,
  weights: oceanToWeights(d.ocean),
}));
