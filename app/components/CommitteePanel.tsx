"use client";

import type { Candidate, CommitteeResult, JudgeRead } from "@/lib/types";
import type { RunState } from "./runState";
import { IconCheck, IconAlert, IconGem } from "./icons";

// Concordance (Kendall's W) and the required-agreement threshold both live in [0,1];
// render the meter across the full range so the fill and the threshold marker line up
// with the slider. Auto-route when W ≥ the threshold (and there's a clear top pick).
const DISPLAY_MAX = 1.0;
const pct = (v: number) => `${Math.max(0, Math.min(1, v / DISPLAY_MAX)) * 100}%`;

// A one-line description of each judge's lens (keyed by the exact judgeName the backend
// ships). The personality is a documented weight-prior, not a role-played costume.
const JUDGE_LENS: Record<string, string> = {
  "The Matchmaker": "Hunts the best technical fit — rewards strong, even out-of-network capability.",
  "The Closer": "Optimizes for conversion — weights quality, speed, and the odds the job books.",
  "The Steward": "Defends the brand — favors reliable, in-network, low-risk partners.",
  "The Operator": "Insists they can deliver — weights real capacity and availability.",
  "The Concierge": "Protects the customer — weights experience and reassurance.",
};

interface Props {
  state: RunState;
  judgeCount: number; // how many reads to expect (for skeletons)
}

export function CommitteePanel({ state, judgeCount }: Props) {
  const committeeStarted = state.stages.committee !== "queued" && state.stages.committee !== "skipped";
  const { reads, committee, candidates } = state;

  const nameById = new Map<string, string>(
    candidates.map((c) => [c.partner.id, c.partner.name]),
  );

  // Which candidate each judge picks; highlight disputed/consensus judges.
  const split = committee?.split;
  const consensusId = committee?.consensusPartnerId ?? null;

  // Sort reads by judge name for stable card order as they stream in.
  const ordered = [...reads].sort((a, b) => a.judgeName.localeCompare(b.judgeName));
  // Show "incoming reveal" skeletons only while the committee is still resolving
  // (no result yet). `judgeCount` is just a hint for the *initial* placeholder
  // count — once reads outrun it (the backend may ship more judges than expected)
  // we keep one trailing slot so the panel reads as live, not stalled.
  const pending = committee
    ? 0
    : ordered.length < judgeCount
      ? judgeCount - ordered.length
      : state.stages.committee === "live"
        ? 1
        : 0;

  return (
    <section className="panel span-2" aria-label="Jury">
      <div className="panel-head">
        <h2>
          Jury <span style={{ color: "var(--purple)" }}>★</span>
        </h2>
        <span className="hint">
          Diverse judges rank independently → Kendall&rsquo;s W agreement gate
        </span>
      </div>
      <div className="panel-body">
        {!committeeStarted ? (
          <div className="idle">
            <IconGem size={22} />
            <span className="idle-title">Committee idle</span>
            <span className="idle-sub">
              Once candidates are retrieved, each judge reads the evidence through
              its own lens and reveals a preference. Cross-family diversity is the
              point — that's where genuine disagreement comes from.
            </span>
          </div>
        ) : (
          <>
            <div className="judges">
              {ordered.map((r) => (
                <JudgeCard
                  key={r.judgeId}
                  read={r}
                  pickedName={nameById.get(r.topCandidateId) ?? r.topCandidateId}
                  isDisputed={
                    !!split &&
                    (r.topCandidateId === split.partnerAId ||
                      r.topCandidateId === split.partnerBId) &&
                    !committee?.converged
                  }
                  isAligned={!!committee?.converged && r.topCandidateId === consensusId}
                />
              ))}
              {Array.from({ length: pending }).map((_, i) => (
                <JudgeSkeleton key={`sk-${i}`} />
              ))}
            </div>

            <ConvergenceMeter committee={committee} nameById={nameById} candidates={candidates} />
          </>
        )}
      </div>
    </section>
  );
}

function JudgeCard({
  read,
  pickedName,
  isDisputed,
  isAligned,
}: {
  read: JudgeRead;
  pickedName: string;
  isDisputed: boolean;
  isAligned: boolean;
}) {
  const lens = JUDGE_LENS[read.judgeName] ?? "a distinct evaluation lens";
  const cls = isDisputed ? "disputed" : isAligned ? "consensus-aligned" : "";
  return (
    <article className={`judge-card ${cls}`}>
      <div className="judge-top">
        <span className="judge-name">{read.judgeName}</span>
      </div>
      <span className="judge-lens">{lens}</span>
      <div className="chip-row">
        <span className="chip family">{read.modelFamily}</span>
      </div>
      <div className="judge-pick">
        picked&nbsp;<b>{pickedName}</b>
      </div>
      {read.rationale && <p className="judge-rationale">“{read.rationale}”</p>}
      {read.evidenceAdjustment && (
        <div className="judge-evidence">
          <IconGem size={12} />
          <span>{read.evidenceAdjustment}</span>
        </div>
      )}
    </article>
  );
}

function JudgeSkeleton() {
  return (
    <div className="judge-skeleton" aria-hidden="true">
      <div className="sk-line" style={{ width: "55%" }} />
      <div className="sk-line" style={{ width: "80%" }} />
      <div className="sk-line" style={{ width: "40%", height: 14 }} />
      <div className="sk-line" style={{ width: "70%" }} />
    </div>
  );
}

function ConvergenceMeter({
  committee,
  nameById,
  candidates,
}: {
  committee: CommitteeResult | null;
  nameById: Map<string, string>;
  candidates: Candidate[];
}) {
  // Fill to the jury's concordance W; the marker sits at the required-agreement threshold.
  // Auto-route when the fill reaches the marker (W ≥ threshold) and the top pick is clear.
  const concordance = committee?.concordance ?? null;
  const minAgreement = committee?.minAgreement ?? null;
  const rho = committee?.avgPairwiseAgreement ?? null;
  const converged = committee?.converged ?? null;

  const fillClass =
    converged == null ? "pending" : converged ? "converged" : "diverged";

  const consensusName = committee?.consensusPartnerId
    ? nameById.get(committee.consensusPartnerId) ?? committee.consensusPartnerId
    : null;

  const split = committee?.split;
  const aName = split ? nameById.get(split.partnerAId) ?? split.partnerAId : null;
  const bName = split ? nameById.get(split.partnerBId) ?? split.partnerBId : null;

  return (
    <div className="meter-wrap">
      <div className="meter-head">
        <span className="lab">Does the jury agree enough to auto-route?</span>
        <span className="meter-nums">
          {concordance != null ? (
            <>
              <span className="d">W={concordance.toFixed(2)}</span>
              <span className="sep">·</span>
              <span className="e">need {minAgreement?.toFixed(2)}</span>
            </>
          ) : (
            <span style={{ color: "var(--faint)" }}>W pending</span>
          )}
        </span>
      </div>

      <div className="meter-track" role="img" aria-label={meterAria(concordance, minAgreement, converged)}>
        {/* jury concordance (Kendall's W) fill */}
        <div
          className={`meter-fill ${fillClass}`}
          style={{ width: concordance != null ? pct(concordance) : "0%" }}
        />
        {/* required-agreement threshold marker */}
        {minAgreement != null && <div className="meter-marker" style={{ left: pct(minAgreement) }} />}
      </div>
      <div className="meter-scale mono">
        <span>0.0 · no agreement</span>
        <span>more agreement →</span>
        <span>{DISPLAY_MAX.toFixed(1)} · unanimous</span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
        <b className="mono" style={{ color: "var(--text)" }}>W</b> (Kendall&rsquo;s coefficient of concordance) is how
        much the jury agrees on the ranking, 0–1
        {rho != null ? ` — here ρ̄ = ${rho.toFixed(2)} average agreement between judge pairs` : ""}. The{" "}
        <b className="mono" style={{ color: "var(--text)" }}>required agreement</b> is the bar the jury must clear:
        W above it (with a clear top pick) → auto-route; below → escalate to a human.
      </p>

      {converged != null && (
        <div className={`verdict ${converged ? "converged" : "diverged"}`}>
          {converged ? <IconCheck size={16} /> : <IconAlert size={16} />}
          {converged ? (
            <span>
              Jury agrees → auto-route eligible
              {consensusName ? (
                <>
                  {" "}
                  · consensus <b>{consensusName}</b>
                </>
              ) : null}
            </span>
          ) : (
            <span>Jury split → escalate to human</span>
          )}
        </div>
      )}

      {converged === null && (
        <div className="verdict pending">
          <IconGem size={15} />
          <span>Awaiting reveals — judges are reading the evidence independently.</span>
        </div>
      )}

      {split && !converged && (
        <div className="split-note">
          Split on{" "}
          <span className="vs">
            {aName} vs {bName}
          </span>
          . {split.note}
        </div>
      )}
    </div>
  );
}

function meterAria(
  concordance: number | null,
  minAgreement: number | null,
  converged: boolean | null,
): string {
  if (concordance == null || minAgreement == null) return "Agreement meter, awaiting judge reveals";
  const verdict = converged ? "jury agrees, auto-route eligible" : "jury split, escalate to human";
  return `Concordance W ${concordance.toFixed(2)}, required ${minAgreement.toFixed(2)}: ${verdict}`;
}
