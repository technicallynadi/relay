// Verify PGlite + pgvector run under Bun (run: `bun run scripts/db-test.ts`).
import { JOB_BY_SCENARIO } from "@/data/jobs";
import { vectorSimilarity } from "@/lib/db";

const job = JOB_BY_SCENARIO.get("ac-tuneup")!;
const sims = await vectorSimilarity("electrical", `${job.summary}. ${job.techNotes}`);
console.log("pgvector cosine similarity (electrical) for the panel job:");
for (const [id, sim] of [...sims.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id}: ${sim.toFixed(4)}`);
}
