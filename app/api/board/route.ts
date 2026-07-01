import { JOBS } from "@/data/jobs";
import { decideOpportunity } from "@/lib/board";

export const runtime = "nodejs";

// The decided opportunities for the seeded demo jobs (the canonical set behind the feed).
// The live feed is served by /api/incoming, which seeds from these and grows as the
// worker pulls more.
export async function GET() {
  const minAgreement = Number(process.env.MIN_AGREEMENT) || 0.6;
  const opportunities = await Promise.all(JOBS.map((j) => decideOpportunity(j, minAgreement)));
  return Response.json({ opportunities });
}
