import { ADJACENCY } from "@/data/adjacency";
import { BRANDS } from "@/data/brands";
import { JOBS } from "@/data/jobs";

export const runtime = "nodejs";

// Seeded incoming jobs (the inbox) + the brand roster (compose-a-job dropdown) + the
// cross-trade adjacency edges (the federation graph).
export async function GET() {
  return Response.json({
    jobs: JOBS.map((j) => ({
      id: j.id,
      brandId: j.brandId,
      trade: j.trade,
      summary: j.summary,
      techNotes: j.techNotes,
      location: j.location.label,
    })),
    brands: BRANDS.map((b) => ({ id: b.id, name: b.name, trade: b.trade })),
    adjacency: ADJACENCY.map((e) => ({
      fromTrade: e.fromTrade,
      toTrade: e.toTrade,
      weight: e.weight,
      rationale: e.rationale,
    })),
  });
}
