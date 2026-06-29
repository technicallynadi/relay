// Federated retrieval: filter the partner graph to the target trade, then compute the
// deterministic sub-scores every judge weighs over. Vector similarity (pgvector) refines
// `fit` when embeddings are present; otherwise a neutral default keeps it deterministic.

import { bm25, normalizeScores } from "@/lib/bm25";
import { vectorSimilarity } from "@/lib/db";
import type { Candidate, Job, Partner, SubScores, Trade } from "@/lib/types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const CAPACITY_SCORE: Record<string, number> = {
  open_today: 1.0,
  this_week: 0.55,
  backlogged: 0.25,
};

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// `lexRel` is the normalized BM25 lexical relevance; `vecSim` the pgvector cosine
// (semantic). Together they form the hybrid "fit" signal. Both default low/neutral so
// fit still degrades gracefully when a signal is unavailable.
export function subScoresFor(
  partner: Partner,
  job: Job,
  targetTrade: Trade,
  vecSim = 0.6,
  lexRel = 0,
): SubScores {
  const dist = haversineMiles(job.location.lat, job.location.lng, partner.lat, partner.lng);
  const proximity = clamp01(1 - dist / 12);
  const capacity = CAPACITY_SCORE[partner.capacityStatus] ?? 0.5;
  const inNetwork = partner.brandId ? 1.0 : 0.35;
  const ratingScore = clamp01((partner.rating - 3.5) / 1.5);
  const customerExperience = ratingScore;
  const tradeMatch = partner.trade === targetTrade ? 1 : 0.5;
  // Hybrid relevance: BM25 lexical + pgvector semantic, gated by trade, nudged by quality.
  const fit = clamp01(0.25 * tradeMatch + 0.4 * lexRel + 0.2 * vecSim + 0.15 * ratingScore);
  const conversion = clamp01(0.6 * ratingScore + 0.2 * proximity + 0.2 * capacity);
  return { fit, capacity, proximity, conversion, inNetwork, customerExperience };
}

function meanSub(s: SubScores): number {
  return (s.fit + s.capacity + s.proximity + s.conversion + s.inNetwork + s.customerExperience) / 6;
}

// Build ranked candidates for a target trade. `vecSimById` optionally supplies the
// pgvector similarity per partner (from the DB-backed retriever).
export function buildCandidates(
  partners: Partner[],
  job: Job,
  targetTrade: Trade,
  vecSimById?: Map<string, number>,
  limit = 4,
): Candidate[] {
  const pool = partners.filter((p) => p.trade === targetTrade);
  // BM25 lexical relevance: the job note (query) vs each partner's capability text.
  const query = `${job.summary} ${job.techNotes} ${job.neededSpecialties.join(" ")}`;
  const docs = pool.map((p) => ({
    id: p.id,
    text: `${p.capabilitySheet} ${p.specialties.join(" ")} ${p.reviews.join(" ")}`,
  }));
  const lexRel = normalizeScores(bm25(query, docs));
  return pool
    .map((p) => ({
      partner: p,
      subScores: subScoresFor(p, job, targetTrade, vecSimById?.get(p.id) ?? 0.6, lexRel.get(p.id) ?? 0),
    }))
    .sort((a, b) => meanSub(b.subScores) - meanSub(a.subScores))
    .slice(0, limit);
}

// DB-backed retrieval: refine `fit` with real pgvector cosine similarity, falling back
// to the deterministic default if the embedded Postgres is unavailable.
export async function retrieveCandidates(
  partners: Partner[],
  job: Job,
  targetTrade: Trade,
  limit = 4,
): Promise<Candidate[]> {
  let vecSimById: Map<string, number> | undefined;
  try {
    vecSimById = await vectorSimilarity(targetTrade, `${job.summary}. ${job.techNotes}`);
  } catch {
    vecSimById = undefined; // pgvector unavailable → deterministic fit fallback
  }
  return buildCandidates(partners, job, targetTrade, vecSimById, limit);
}
