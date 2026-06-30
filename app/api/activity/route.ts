import { PARTNER_BY_ID } from "@/data/partners";
import { allReferrals } from "@/lib/store";

export const runtime = "nodejs";

// The session's routed-referral audit feed. Real records written by the pipeline; the
// Activity view reads this (empty until the operator routes something).
export function GET() {
  const referrals = allReferrals()
    .map((r) => {
      const pid =
        r.committee?.consensusPartnerId ?? r.committee?.split?.partnerAId ?? r.candidateIds[0] ?? null;
      const partner = pid ? (PARTNER_BY_ID.get(pid)?.name ?? null) : null;
      return {
        id: r.id,
        trade: r.detectedTrade,
        partner,
        decision: r.decision,
        action: r.humanAction,
        outcome: r.outcome,
        delta: r.committee?.deltaMax ?? null,
        createdAt: r.createdAt,
      };
    })
    .reverse();
  return Response.json({ referrals });
}
