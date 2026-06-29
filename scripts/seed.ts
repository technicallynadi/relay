// Warm the embedded Postgres + precompute partner embeddings (run: `bun run seed`).
// Optional — the app self-seeds on first request — but running it ahead of a live demo
// makes the first scenario instant.

import { PARTNERS } from "@/data/partners";
import { getDb } from "@/lib/db";

const db = await getDb();
const res = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM partners");
console.log(`Seeded ${res.rows[0].n} / ${PARTNERS.length} partners into pgvector.`);
console.log(
  process.env.OPENAI_API_KEY
    ? "Embeddings: OpenAI text-embedding-3-small (semantic)."
    : "Embeddings: local fallback (set OPENAI_API_KEY for semantic fit).",
);
