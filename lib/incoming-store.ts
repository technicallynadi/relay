// The live opportunity feed the worker fills. Seeded once with the canonical demo jobs
// so the board is never empty (even with no worker running); the worker prepends
// freshly-pulled opportunities on its cron. Kept on globalThis so every route handler
// shares it and it survives HMR. Newest first, capped.

import { JOBS } from "@/data/jobs";
import { type BoardOpportunity, decideOpportunity } from "@/lib/board";

const MAX = 60;
const minAgreement = () => Number(process.env.MIN_AGREEMENT) || 0.6;

const g = globalThis as unknown as {
  __relayIncoming?: BoardOpportunity[];
  __relaySeeded?: Promise<void>;
};

function store(): BoardOpportunity[] {
  return (g.__relayIncoming ??= []);
}

// Seed the canonical demo opportunities exactly once (idempotent across concurrent calls).
export function ensureSeeded(): Promise<void> {
  if (!g.__relaySeeded) {
    g.__relaySeeded = Promise.all(JOBS.map((j) => decideOpportunity(j, minAgreement()))).then((seed) => {
      store().push(...seed);
    });
  }
  return g.__relaySeeded;
}

export function addIncoming(opp: BoardOpportunity): void {
  const s = store();
  s.unshift(opp); // newest at the top
  if (s.length > MAX) s.length = MAX;
}

// Remove one opportunity from the feed once it's been acted on (sent/skipped) — it lives
// in the Activity log from that point on, so the feed stays a queue of open items.
export function resolveIncoming(jobId: string): BoardOpportunity | null {
  const s = store();
  const i = s.findIndex((o) => o.jobId === jobId);
  if (i === -1) return null;
  const [removed] = s.splice(i, 1);
  return removed;
}

export function listIncoming(): BoardOpportunity[] {
  return store();
}

export function clearIncoming(): void {
  store().length = 0;
  g.__relaySeeded = undefined; // next GET re-seeds the demo jobs
}
