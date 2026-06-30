"use client";

import type { Candidate, Criterion } from "@/lib/types";
import type { RunState } from "./runState";
import { disputedPartnerIds, tradeLabel } from "./runState";
import { IconStar, IconNetwork } from "./icons";

// The sub-scores we surface as bars on the compact sheet (the spec's headline four
// + customer experience). inNetwork/conversion are conveyed via the chip + a row.
const SHEET_CRITERIA: { key: Criterion; label: string }[] = [
  { key: "fit", label: "fit" },
  { key: "capacity", label: "capacity" },
  { key: "proximity", label: "proximity" },
  { key: "customerExperience", label: "experience" },
];

const CAPACITY_LABEL: Record<string, string> = {
  open_today: "open today",
  this_week: "this week",
  backlogged: "backlogged",
};

interface Props {
  state: RunState;
}

export function CandidateSheets({ state }: Props) {
  const { candidates, committee } = state;
  const consensusId = committee?.consensusPartnerId ?? null;
  const disputed = disputedPartnerIds(state);

  if (candidates.length === 0) {
    return (
      <section className="panel" aria-label="Candidate partners">
        <div className="panel-head">
          <h2>Candidate partners</h2>
          <span className="hint">Federated retrieval</span>
        </div>
        <div className="panel-body">
          <div className="idle">
            <IconNetwork size={22} />
            <span className="idle-title">No candidates yet</span>
            <span className="idle-sub">
              The retriever pulls in-network partners from the 19-brand graph and
              ranks them with pgvector + deterministic sub-scores.
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="Candidate partners">
      <div className="panel-head">
        <h2>Candidate partners</h2>
        <span className="hint">{candidates.length} retrieved · sub-scores 0–1</span>
      </div>
      <div className="panel-body">
        <div className="candidates">
          {candidates.map((c) => (
            <CandidateCard
              key={c.partner.id}
              candidate={c}
              isConsensus={consensusId === c.partner.id}
              isDisputed={disputed.has(c.partner.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CandidateCard({
  candidate,
  isConsensus,
  isDisputed,
}: {
  candidate: Candidate;
  isConsensus: boolean;
  isDisputed: boolean;
}) {
  const { partner, subScores } = candidate;
  const inNetwork = partner.brandId != null;
  const cls = isConsensus ? "consensus" : isDisputed ? "disputed" : "";

  return (
    <article className={`cand-card ${cls}`}>
      {isConsensus && <span className="cand-flag consensus">consensus</span>}
      {!isConsensus && isDisputed && <span className="cand-flag disputed">disputed</span>}

      <div className="cand-top">
        <span className="cand-name">{partner.name}</span>
      </div>

      <div className="cand-meta">
        <span className={`net-chip ${inNetwork ? "in" : "out"}`}>
          {inNetwork ? "in-network" : "out-of-network"}
        </span>
        <span className="trade-pill">{tradeLabel(partner.trade)}</span>
        <span className="cand-rating mono">
          <IconStar size={11} className="star" />
          {partner.rating.toFixed(1)}
          <span style={{ color: "var(--faint)" }}>
            ({partner.reviewCount})
          </span>
        </span>
      </div>

      <span className={`cap-status mono ${partner.capacityStatus}`}>
        {CAPACITY_LABEL[partner.capacityStatus] ?? partner.capacityStatus}
      </span>

      <div className="subscores">
        {SHEET_CRITERIA.map(({ key, label }) => {
          const v = subScores[key] ?? 0;
          return (
            <div className="subscore" key={key}>
              <span className="ss-lab">{label}</span>
              <span className="ss-bar">
                <span className="ss-fill" style={{ width: `${Math.round(v * 100)}%` }} />
              </span>
              <span className="ss-val mono">{v.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
