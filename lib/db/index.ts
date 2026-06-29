// Embedded Postgres (PGlite) + pgvector. Holds the partner capability embeddings and
// serves cosine-similarity retrieval. Seeded once per process from the partner graph;
// embeddings come from the model adapter (OpenAI, or the keyless local fallback).

import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { PARTNERS } from "@/data/partners";
import { EMBED_DIM, embed } from "@/lib/models";

let dbPromise: Promise<PGlite> | null = null;

function partnerText(p: (typeof PARTNERS)[number]): string {
  return `${p.capabilitySheet} ${p.specialties.join(" ")} ${p.reviews.join(" ")}`;
}

async function init(): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector } });
  await db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id text PRIMARY KEY,
      name text NOT NULL,
      trade text NOT NULL,
      in_network boolean NOT NULL,
      embedding vector(${EMBED_DIM})
    );
  `);
  const embeddings = await embed(PARTNERS.map(partnerText));
  for (let i = 0; i < PARTNERS.length; i++) {
    const p = PARTNERS[i];
    await db.query(
      "INSERT INTO partners (id, name, trade, in_network, embedding) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
      [p.id, p.name, p.trade, Boolean(p.brandId), `[${embeddings[i].join(",")}]`],
    );
  }
  return db;
}

export function getDb(): Promise<PGlite> {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

// pgvector cosine retrieval for one trade. Returns partnerId → similarity in [0,1].
export async function vectorSimilarity(trade: string, queryText: string): Promise<Map<string, number>> {
  const db = await getDb();
  const [q] = await embed([queryText]);
  const res = await db.query<{ id: string; dist: number }>(
    "SELECT id, embedding <=> $1 AS dist FROM partners WHERE trade = $2",
    [`[${q.join(",")}]`, trade],
  );
  const sims = new Map<string, number>();
  for (const row of res.rows) {
    // pgvector <=> is cosine distance ∈ [0,2]; map to similarity ∈ [0,1].
    sims.set(row.id, Math.max(0, Math.min(1, 1 - Number(row.dist) / 2)));
  }
  return sims;
}
