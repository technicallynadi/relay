// In-memory referral audit store. Each pipeline run writes a record; the human gate
// updates it. (Production would persist this to Postgres; in-memory is fine for the demo.)

import type { HumanAction, ReferralRecord } from "@/lib/types";

// Stash on globalThis so every route handler shares one store (Next can hand each route
// its own module copy) and it survives HMR.
const g = globalThis as unknown as {
  __relayStore?: Map<string, ReferralRecord>;
  __relayCounter?: number;
};
const store: Map<string, ReferralRecord> = (g.__relayStore ??= new Map());

export function createReferral(rec: Omit<ReferralRecord, "id" | "createdAt">): ReferralRecord {
  g.__relayCounter = (g.__relayCounter ?? 0) + 1;
  const id = `ref_${g.__relayCounter.toString().padStart(4, "0")}`;
  const full: ReferralRecord = { ...rec, id, createdAt: new Date().toISOString() };
  store.set(id, full);
  return full;
}

export function getReferral(id: string): ReferralRecord | undefined {
  return store.get(id);
}

export function applyAction(id: string, action: HumanAction): ReferralRecord | null {
  const r = store.get(id);
  if (!r) return null;
  r.humanAction = action;
  // Simulated outcome: a sent referral is accepted by the partner; skip = declined.
  if (action === "send") r.outcome = "accepted";
  else if (action === "skip") r.outcome = "declined";
  return r;
}

export function allReferrals(): ReferralRecord[] {
  return [...store.values()];
}
