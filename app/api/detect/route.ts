import { JOB_BY_SCENARIO, buildCustomJob } from "@/data/jobs";
import { detect } from "@/lib/pipeline";

export const runtime = "nodejs";

// Run ONLY the Opportunity Detector (deterministic, instant, no LLM cost) on a seeded
// scenario or a job composed on the spot. Returns the full job + what it found.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  let job = undefined;
  if (typeof body.scenarioKey === "string") {
    job = JOB_BY_SCENARIO.get(body.scenarioKey);
  } else if (typeof body.brandId === "string" && typeof body.techNotes === "string") {
    if (!body.techNotes.trim()) {
      return Response.json({ ok: false, error: "tech notes are empty" }, { status: 400 });
    }
    job = buildCustomJob(body.brandId, body.techNotes, typeof body.summary === "string" ? body.summary : undefined);
  }

  if (!job) {
    return Response.json(
      { ok: false, error: "provide scenarioKey, or brandId + techNotes" },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, job, detection: detect(job) });
}
