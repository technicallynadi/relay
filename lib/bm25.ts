// Minimal BM25 over a small in-memory corpus — the lexical half of hybrid retrieval.
// Scores a job's tech note (the query) against each candidate partner's capability text
// (the documents). Fused with pgvector cosine (the semantic half) downstream so "finding
// the signal" is real hybrid search, not keyword overlap.

import { stemmer } from "stemmer";

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "was", "is", "it",
  "at", "as", "by", "be", "this", "that", "our", "we", "you", "your", "they", "their", "i",
  "but", "so", "up", "out", "not", "no", "had", "has", "have", "were", "are", "from", "now",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => stemmer(t));
}

export interface Bm25Doc {
  id: string;
  text: string;
}

// Raw BM25 score per doc id for the query (Okapi BM25, k1/b tunable).
export function bm25(query: string, docs: Bm25Doc[], k1 = 1.5, b = 0.75): Map<string, number> {
  const corpus = docs.map((d) => ({ id: d.id, toks: tokenize(d.text) }));
  const N = corpus.length || 1;
  const avgdl = corpus.reduce((s, d) => s + d.toks.length, 0) / N || 1;

  const df = new Map<string, number>();
  for (const d of corpus) {
    for (const t of new Set(d.toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = (t: string) => {
    const n = df.get(t) ?? 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  const qToks = [...new Set(tokenize(query))];
  const scores = new Map<string, number>();
  for (const d of corpus) {
    const tf = new Map<string, number>();
    for (const t of d.toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const q of qToks) {
      const f = tf.get(q) ?? 0;
      if (!f) continue;
      s += idf(q) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.toks.length) / avgdl)));
    }
    scores.set(d.id, s);
  }
  return scores;
}

// Max-normalize scores to [0,1] across the candidate set.
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  let max = 0;
  for (const v of scores.values()) max = Math.max(max, v);
  const out = new Map<string, number>();
  for (const [id, v] of scores) out.set(id, max > 0 ? v / max : 0);
  return out;
}
