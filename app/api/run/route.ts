import { buildCustomJob } from "@/data/jobs";
import { runPipelineForJob } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams the pipeline as newline-delimited JSON RunEvents for a { brandId, techNotes } job
// (the board's cards and composed jobs both route through here).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const minAgreement = typeof body.minAgreement === "number" ? body.minAgreement : undefined;
  const brandId = typeof body.brandId === "string" ? body.brandId : "";
  const techNotes = typeof body.techNotes === "string" ? body.techNotes : "";
  const summary = typeof body.summary === "string" ? body.summary : undefined;
  const gen = runPipelineForJob(buildCustomJob(brandId, techNotes, summary), { minAgreement });

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
