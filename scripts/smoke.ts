// End-to-end smoke test of the pipeline (run: `bun run scripts/smoke.ts`).
// Runs each scenario through the real orchestrator and prints the decision path.

import { runPipeline } from "@/lib/pipeline";

for (const key of ["drain-job", "ac-tuneup", "shelf-install"]) {
  console.log(`\n=== scenario: ${key} ===`);
  let decision = "?";
  for await (const ev of runPipeline(key, { minAgreement: 0.6 })) {
    if (ev.type === "detection") {
      console.log(`  detector: hasReferral=${ev.detection.hasReferral} trade=${ev.detection.trade ?? "—"}`);
    } else if (ev.type === "candidates") {
      console.log(`  retriever: ${ev.candidates.map((c) => c.partner.name).join(", ")}`);
    } else if (ev.type === "judge_read") {
      console.log(`    judge ${ev.read.judgeName} (${ev.read.modelFamily}) → ${ev.read.topCandidateId}`);
    } else if (ev.type === "committee") {
      const r = ev.result;
      console.log(
        `  jury: W=${r.concordance.toFixed(3)} need=${r.minAgreement} margin=${r.topMargin.toFixed(2)} converged=${r.converged} → ${r.decision}` +
          (r.consensusPartnerId ? ` consensus=${r.consensusPartnerId}` : "") +
          (r.split ? ` split=${r.split.partnerAId} vs ${r.split.partnerBId}` : ""),
      );
    } else if (ev.type === "done") {
      decision = ev.decision;
    }
  }
  console.log(`  DONE → ${decision}`);
}
