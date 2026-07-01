import { buildCustomJob } from "@/data/jobs";
import { runPipeline, runPipelineForJob } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams the pipeline as newline-delimited JSON RunEvents. Accepts a seeded
// { scenarioKey } or a composed { brandId, techNotes } job.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const minAgreement = typeof body.minAgreement === "number" ? body.minAgreement : undefined;
  const gen =
    typeof body.brandId === "string" && typeof body.techNotes === "string"
      ? runPipelineForJob(buildCustomJob(body.brandId, body.techNotes, typeof body.summary === "string" ? body.summary : undefined), { minAgreement })
      : runPipeline(typeof body.scenarioKey === "string" ? body.scenarioKey : "drain-job", { minAgreement });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of gen) {
          controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "error", message: String(e) })}\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
