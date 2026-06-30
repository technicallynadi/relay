import { PARTNER_BY_ID } from "@/data/partners";
import { deliver } from "@/lib/delivery";
import { applyAction, getReferral } from "@/lib/store";
import type { HumanAction } from "@/lib/types";

export const runtime = "nodejs";

const VALID: HumanAction[] = ["send", "edit", "skip"];

// The human gate: Send / Edit / Skip on a referral, returning the simulated outcome.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const referralId = String(body.referralId ?? "");
  const action = body.action as HumanAction;

  if (!referralId || !VALID.includes(action)) {
    return Response.json({ ok: false, error: "referralId and a valid action are required" }, { status: 400 });
  }
  const updated = applyAction(referralId, action);
  if (!updated) {
    return Response.json({ ok: false, error: "referral not found" }, { status: 404 });
  }

  let delivery;
  if (action === "send" && updated.draftedMessage) {
    const pid =
      updated.committee?.consensusPartnerId ??
      updated.committee?.split?.partnerAId ??
      updated.candidateIds[0];
    const partner = pid ? PARTNER_BY_ID.get(pid) : undefined;
    delivery = await deliver({ message: updated.draftedMessage, partnerName: partner?.name ?? "the partner" });
    updated.delivery = delivery;
  }

  return Response.json({ ok: true, outcome: updated.outcome, action, delivery });
}

// Convenience: GET /api/action?id=ref_0001 returns the audit record.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const ref = getReferral(id);
  if (!ref) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  return Response.json({ ok: true, referral: ref });
}
