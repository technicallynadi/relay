// Shared domain + pipeline contract for the Referral Opportunity Engine.
// Every module builds against these types.

export type Trade =
  | "plumbing" | "hvac" | "electrical" | "restoration" | "cleaning"
  | "handyman" | "appliance" | "glass" | "landscaping" | "pest"
  | "painting" | "windows" | "garage_door" | "dryer_vent" | "shelving"
  | "junk_removal" | "inspection" | "property_management" | "lawn";

export interface Brand {
  id: string;
  name: string;
  trade: Trade;
  slug: string;
}

// A directed cross-trade edge: a job in `fromTrade` may imply a `toTrade` referral.
export interface TradeAdjacency {
  fromTrade: Trade;
  toTrade: Trade;
  weight: number; // 0-1 strength of the cross-trade signal
  rationale: string;
}

export type CapacityStatus = "open_today" | "this_week" | "backlogged";

export interface Partner {
  id: string;
  name: string;
  brandId: string | null; // null = out-of-network local business
  trade: Trade;
  lat: number;
  lng: number;
  rating: number; // 0-5
  reviewCount: number;
  capacityStatus: CapacityStatus;
  capabilitySheet: string; // unstructured: specialties, hours, coverage
  reviews: string[]; // unstructured customer reviews
  specialties: string[]; // structured capability tags (drive the deterministic fit score)
  embedding?: number[]; // capability+reviews embedding, precomputed at seed
}

export interface JobLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface Job {
  id: string;
  scenarioKey: string; // neutral job id — the decision is computed live, not implied by the key
  brandId: string; // brand that performed the completed job
  trade: Trade; // trade performed
  location: JobLocation;
  summary: string;
  techNotes: string; // free-text — the cross-trade signal lives here
  neededSpecialties: string[]; // capability tags the adjacent-trade job calls for
}

// The criteria pool every judge weights over. Sub-scores and judge weights share these keys.
export const CRITERIA = [
  "fit",
  "capacity",
  "proximity",
  "conversion",
  "inNetwork",
  "customerExperience",
] as const;
export type Criterion = (typeof CRITERIA)[number];
export type SubScores = Record<Criterion, number>; // each 0-1
export type Weights = Record<Criterion, number>; // each 0-1 (need not sum to 1)

export interface Candidate {
  partner: Partner;
  subScores: SubScores;
}

export interface OceanVector {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number; // each 0-1
}

export interface Judge {
  id: string;
  name: string;
  role: string; // one-line lens description
  ocean: OceanVector; // documented prior — NOT role-played in the prompt
  weights: Weights; // derived from ocean; what actually drives scoring
  modelFamily: string; // "anthropic" | "openai" | "meta" ...
  model: string; // concrete model id for the provider
}

// A judge's revealed assessment over the candidate set (the "reveal" step).
export interface JudgeRead {
  judgeId: string;
  judgeName: string;
  modelFamily: string;
  scores: Record<string, number>; // candidateId -> weighted score after the evidence-read
  preference: number[]; // normalized score vector in `candidateOrder`
  topCandidateId: string;
  rationale: string; // one line, lens-flavored
  evidenceAdjustment?: string; // set when the read departed from the deterministic sub-scores
}

export type Decision = "auto_route_eligible" | "escalated" | "declined";

export interface CommitteeResult {
  candidateOrder: string[]; // candidateIds defining the preference-vector index order
  reads: JudgeRead[];
  concordance: number; // Kendall's W ∈ [0,1] — how much the jury agrees on the ranking
  avgPairwiseAgreement: number; // ρ̄ = (mW−1)/(m−1) — mean pairwise judge agreement
  minAgreement: number; // required concordance to auto-route (the live threshold)
  topMargin: number; // Borda winner's normalized lead over the runner-up ∈ [0,1]
  marginFloor: number; // the top-1 margin guard the winner must clear
  converged: boolean; // concordance ≥ minAgreement AND topMargin ≥ marginFloor
  consensusPartnerId: string | null; // Borda consensus winner (null when escalated)
  decision: Decision; // auto_route_eligible | escalated
  split?: { partnerAId: string; partnerBId: string; note: string };
}

export interface Detection {
  hasReferral: boolean;
  trade: Trade | null;
  signal: string;
  rationale: string;
}

export interface Handoff {
  customerMessage: string;
  internalNote: string;
}

export type HumanAction = "send" | "edit" | "skip";

export interface DeliveryResult {
  delivered: boolean;
  provider: "twilio" | "resend" | "simulated";
  channel: "sms" | "email" | "simulated";
  detail: string;
}

export interface ReferralRecord {
  id: string;
  jobId: string;
  detectedTrade: Trade | null;
  candidateIds: string[];
  committee: CommitteeResult | null;
  decision: Decision;
  humanAction: HumanAction | null;
  draftedMessage: string | null;
  outcome: "accepted" | "closed" | "declined" | null;
  delivery?: DeliveryResult;
  createdAt: string;
}

// Streamed pipeline events → the observatory UI.
export type RunEvent =
  | { type: "job"; job: Job }
  | { type: "stage"; stage: PipelineStage; status: "start" | "done" }
  | { type: "token"; stage: PipelineStage; text: string }
  | { type: "detection"; detection: Detection }
  | { type: "candidates"; candidates: Candidate[] }
  | { type: "judge_read"; read: JudgeRead }
  | { type: "committee"; result: CommitteeResult }
  | { type: "handoff"; handoff: Handoff }
  | { type: "done"; referralId: string; decision: Decision }
  | { type: "error"; message: string };

export type PipelineStage = "detector" | "retriever" | "committee" | "composer";
