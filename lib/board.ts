// One place that turns a completed-job into a decided opportunity: detect → retrieve →
// deterministic jury (Kendall's W). Used by /api/board, /api/incoming, and the worker.

import { BRAND_BY_ID } from "@/data/brands";
import { runCommitteeDeterministic } from "@/lib/committee";
import { effectiveJudges } from "@/lib/judges";
import { detect } from "@/lib/pipeline";
import { getPartners } from "@/lib/places";
import { retrieveCandidates } from "@/lib/retrieval";
import type { Decision, Job } from "@/lib/types";

export interface BoardOpportunity {
  jobId: string;
  brandId: string;
  brand: string;
  fromTrade: string;
  trade: string | null;
  location: string;
  summary: string;
  techNotes: string;
  decision: Decision;
  partner: string | null;
  agreement: number | null; // jury concordance (Kendall's W)
  margin: number | null; // Borda winner's lead over the runner-up
  minAgreement: number;
}

export async function decideOpportunity(job: Job, minAgreement: number): Promise<BoardOpportunity> {
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
    return { ...base, trade: null, decision: "declined", partner: null, agreement: null, margin: null };
  }

  const partners = await getPartners(detection.trade, job.location);
  const candidates = await retrieveCandidates(partners, job, detection.trade);
  const result = runCommitteeDeterministic(effectiveJudges(), candidates, minAgreement);
  const pid =
    result.consensusPartnerId ?? result.split?.partnerAId ?? candidates[0]?.partner.id ?? null;
  const partnerName = pid ? (candidates.find((c) => c.partner.id === pid)?.partner.name ?? null) : null;

  return {
    ...base,
    trade: detection.trade,
    decision: result.decision,
    partner: partnerName,
    agreement: result.concordance,
    margin: result.topMargin,
  };
}
