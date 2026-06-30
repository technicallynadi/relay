"use client";

import { useState } from "react";
import type { RunState } from "./runState";
import { decisionBadge, tradeLabel } from "./runState";
import { IconRecord, IconChevron } from "./icons";

interface Props {
  state: RunState;
}

// The final referral-record summary — a secondary, collapsible panel. Mirrors the
// `referrals` audit row: scenario, decision, δ_max/ε, consensus or split, human
// action, outcome.
export function AuditLog({ state }: Props) {
  const [open, setOpen] = useState(false);
  const complete = state.phase === "complete";
  const badge = decisionBadge(state.decision);

  const committee = state.committee;
  const consensusName = committee?.consensusPartnerId
    ? state.candidates.find((c) => c.partner.id === committee.consensusPartnerId)?.partner.name
    : null;
  const split = committee?.split;
  const aName = split
    ? state.candidates.find((c) => c.partner.id === split.partnerAId)?.partner.name ?? split.partnerAId
    : null;
  const bName = split
    ? state.candidates.find((c) => c.partner.id === split.partnerBId)?.partner.name ?? split.partnerBId
    : null;

  return (
    <section className="panel span-2" aria-label="Audit log">
      <button
        type="button"
        className={`audit-toggle${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <IconRecord size={16} />
          Audit log
          {complete && (
            <span className={`badge ${badge.tone}`} style={{ marginLeft: 4 }}>
              {badge.text}
            </span>
          )}
        </span>
        <IconChevron size={16} className="chev" />
      </button>

      {open && (
        <div className="audit-body">
          {!complete ? (
            <p className="hint" style={{ paddingTop: 14 }}>
              The referral record is written when the run completes.
            </p>
          ) : (
            <div className="audit-grid">
              <Cell k="Referral ID" v={state.referralId ?? "—"} mono />
              <Cell k="Scenario" v={state.job?.scenarioKey ?? "—"} mono />
              <Cell
                k="Detected trade"
                v={state.detection?.hasReferral ? tradeLabel(state.detection.trade) : "none"}
              />
              <Cell k="Decision" v={badge.text} />
              <Cell
                k="δ_max"
                v={committee ? committee.deltaMax.toFixed(3) : "n/a"}
                mono
              />
              <Cell k="ε threshold" v={committee ? committee.epsilon.toFixed(2) : "n/a"} mono />
              <Cell
                k="δ_mean"
                v={committee ? committee.deltaMean.toFixed(3) : "n/a"}
                mono
              />
              <Cell
                k="Noise floor"
                v={committee ? committee.noiseFloor.toFixed(3) : "n/a"}
                mono
              />
              <Cell k="Judges" v={committee ? String(committee.reads.length) : "0"} mono />
              <Cell
                k={split ? "Split between" : "Consensus partner"}
                v={split ? `${aName} ⟷ ${bName}` : consensusName ?? "—"}
              />
              <Cell k="Human action" v={state.humanAction ?? "—"} />
              <Cell k="Outcome" v={state.outcome ?? "—"} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="audit-cell">
      <span className="ac-key">{k}</span>
      <span className={`ac-val${mono ? " mono" : ""}`}>{v}</span>
    </div>
  );
}
