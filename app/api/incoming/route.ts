import { decideOpportunity } from "@/lib/board";
import { addIncoming, clearIncoming, ensureSeeded, listIncoming, resolveIncoming } from "@/lib/incoming-store";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";

// The live opportunity feed. GET returns it (seeded with the demo jobs so it's never
// empty); POST is how the ingestion worker pushes a freshly-pulled job — the engine
// detects + routes it here and stores the opportunity; DELETE clears the feed.
export async function GET() {
  await ensureSeeded();
  return Response.json({ opportunities: listIncoming() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { job?: Job } | null;
  if (!body?.job?.brandId) {
    return Response.json({ ok: false, error: "a job is required" }, { status: 400 });
  }
  const minAgreement = Number(process.env.MIN_AGREEMENT) || 0.6;
  const opportunity = await decideOpportunity(body.job, minAgreement);
  addIncoming(opportunity);
  return Response.json({ ok: true, opportunity });
}

// DELETE ?jobId=X resolves a single opportunity (send/skip → it moves to Activity);
// DELETE with no jobId clears the whole feed (and re-seeds the baseline on the next read).
export async function DELETE(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (jobId) {
    const removed = resolveIncoming(jobId);
    return Response.json({ ok: removed != null });
  }
  clearIncoming();
  return Response.json({ ok: true });
}
