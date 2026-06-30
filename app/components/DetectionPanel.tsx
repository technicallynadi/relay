"use client";

import type { RunState } from "./runState";
import { tradeLabel } from "./runState";
import { IconCheck, IconNo } from "./icons";

interface Props {
  state: RunState;
}

// The detector's verdict, surfaced as a calm callout. Gates the whole pipeline —
// when hasReferral is false (declines), this is effectively the terminal state.
export function DetectionPanel({ state }: Props) {
  const det = state.detection;
  if (!det) return null;

  const yes = det.hasReferral;
  return (
    <section className="panel span-2" aria-label="Detection">
      <div className="panel-head">
        <h2>Detection</h2>
        <span className="hint">Opportunity Detector verdict</span>
      </div>
      <div className="panel-body">
        <div className={`detection ${yes ? "yes" : "no"}`}>
          <span className="det-icon" style={{ color: yes ? "var(--teal)" : "var(--muted)" }}>
            {yes ? <IconCheck size={20} /> : <IconNo size={20} />}
          </span>
          <div className="det-body">
            <div className="det-title">
              {yes ? (
                <>
                  Cross-trade opportunity →{" "}
                  <span className="trade-pill">{tradeLabel(det.trade)}</span>
                </>
              ) : (
                "No cross-trade opportunity"
              )}
            </div>
            <div className="det-signal">{det.signal}</div>
            <div className="det-rationale">{det.rationale}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
