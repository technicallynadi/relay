import { BRAND_BY_ID } from "@/data/brands";
import { JOBS } from "@/data/jobs";
import { JUDGES } from "@/data/judges";
import { getPartners } from "@/lib/places";
import { runCommitteeDeterministic } from "@/lib/committee";
import { detect } from "@/lib/pipeline";
import { retrieveCandidates } from "@/lib/retrieval";

export const runtime = "nodejs";

// Deterministic batch decision for every seed job — drives the auto-run opportunity
// board / live feed. Fast (no LLM): detect → retrieve → deterministic committee. The
// live LLM committee runs only when the operator drills into a card.
export async function GET() {
  const minAgreement = Number(process.env.MIN_AGREEMENT) || 0.6;
  const opportunities = [];

  for (const job of JOBS) {
    const brand = BRAND_BY_ID.get(job.brandId);
    const base = {
      jobId: job.id,
      brandId: job.brandId,
      brand: brand?.name ?? job.brandId,
      fromTrade: job.trade,
      location: job.location.label,
      summary: job.summary,
      techNotes: job.techNotes,
      minAgreement,
    };

    const detection = detect(job);
    if (!detection.hasReferral || !detection.trade) {
      opportunities.push({ ...base, trade: null, decision: "declined", partner: null, agreement: null, margin: null });
      continue;
    }

    const partners = await getPartners(detection.trade, job.location);
    const candidates = await retrieveCandidates(partners, job, detection.trade);
    const result = runCommitteeDeterministic(JUDGES, candidates, minAgreement);
    const pid =
      result.consensusPartnerId ?? result.split?.partnerAId ?? candidates[0]?.partner.id ?? null;
    const partnerName = pid ? (candidates.find((c) => c.partner.id === pid)?.partner.name ?? null) : null;
    opportunities.push({
      ...base,
      trade: detection.trade,
      decision: result.decision,
      partner: partnerName,
      agreement: result.concordance,
      margin: result.topMargin,
    });
  }

  return Response.json({ opportunities });
}
