"use client";

import type { Candidate, CommitteeResult, JudgeRead } from "@/lib/types";
import type { RunState } from "./runState";
import { IconCheck, IconAlert, IconGem } from "./icons";

// δ and ε both live in [0,1]; render the meter across the full range so the bar and the
// ε marker line up with the ε slider (0.01–1.0) and a strong split (δ≈0.74) still fits.
// The verdict uses the true δ_max < ε comparison, not the display scale.
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
    <section className="panel span-2" aria-label="CRPC committee">
      <div className="panel-head">
        <h2>
          CRPC committee <span style={{ color: "var(--purple)" }}>★</span>
        </h2>
        <span className="hint">
          Diverse judges score independently → pairwise δ → δ&lt;ε gate
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
  // Pre-verdict: show the ε marker + a pending track. Post-verdict: fill to δ_max.
  const epsilon = committee?.epsilon ?? null;
  const deltaMax = committee?.deltaMax ?? null;
  const noiseFloor = committee?.noiseFloor ?? 0.02;
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
        <span className="lab">Do the judges agree enough to auto-route?</span>
        <span className="meter-nums">
          {deltaMax != null ? (
            <>
              <span className="d">δ={deltaMax.toFixed(2)}</span>
              <span className="sep">·</span>
              <span className="e">ε={epsilon?.toFixed(2)}</span>
            </>
          ) : (
            <span style={{ color: "var(--faint)" }}>δ pending</span>
          )}
        </span>
      </div>

      <div className="meter-track" role="img" aria-label={meterAria(deltaMax, epsilon, converged)}>
        {/* within-judge noise floor — δ below this is just sampling jitter */}
        <div className="meter-noise" style={{ width: pct(noiseFloor) }} title="noise floor" />
        {/* δ fill */}
        <div
          className={`meter-fill ${fillClass}`}
          style={{ width: deltaMax != null ? pct(deltaMax) : "0%" }}
        />
        {/* ε threshold marker */}
        {epsilon != null && <div className="meter-marker" style={{ left: pct(epsilon) }} />}
      </div>
      <div className="meter-scale mono">
        <span>0.0 · agree</span>
        <span>more disagreement →</span>
        <span>{DISPLAY_MAX.toFixed(1)} · opposed</span>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
        <b className="mono" style={{ color: "var(--text)" }}>δ</b> is how much the judges disagree on the ranking;{" "}
        <b className="mono" style={{ color: "var(--text)" }}>ε</b> is how much disagreement we&rsquo;ll tolerate before
        asking a person. δ under ε → trust it and auto-route; δ over ε → escalate to a human.
      </p>

      {converged != null && (
        <div className={`verdict ${converged ? "converged" : "diverged"}`}>
          {converged ? <IconCheck size={16} /> : <IconAlert size={16} />}
          {converged ? (
            <span>
              Converged → auto-route eligible
              {consensusName ? (
                <>
                  {" "}
                  · consensus <b>{consensusName}</b>
                </>
              ) : null}
            </span>
          ) : (
            <span>Diverged → escalate to human</span>
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
  deltaMax: number | null,
  epsilon: number | null,
  converged: boolean | null,
): string {
  if (deltaMax == null || epsilon == null) return "Convergence meter, awaiting judge reveals";
  const verdict = converged ? "converged, auto-route eligible" : "diverged, escalate to human";
  return `Delta max ${deltaMax.toFixed(2)}, epsilon ${epsilon.toFixed(2)}: ${verdict}`;
}
