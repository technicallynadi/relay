"use client";

import { useState } from "react";
import { IconNo, IconPen, IconScan, IconSend, IconTune } from "./icons";
import { DotGrid } from "./DotGrid";

export type RouteTarget = { brandId: string; techNotes: string; summary?: string };

export interface SeededJob {
  id: string;
  brandId: string;
  trade: string;
  summary: string;
  techNotes: string;
  location: string;
}
export interface BrandOpt {
  id: string;
  name: string;
  trade: string;
}
export interface Opportunity {
  id: string;
  target: RouteTarget;
  brandName: string;
  trade: string;
  rationale: string;
}

interface Props {
  jobs: SeededJob[];
  brands: BrandOpt[];
  brandName: (id: string) => string;
  opportunities: Opportunity[];
  noOppNote: string | null;
  epsilon: number;
  running: boolean;
  detecting: string | null;
  routingId: string | null;
  onDetectSeeded: (job: SeededJob) => void;
  onDetectCustom: (brandId: string, techNotes: string) => void;
  onRoute: (opp: Opportunity) => void;
  onEpsilon: (v: number) => void;
}

// A small deterministic dot-pattern per card so the matrix motif varies but never
// flickers. Derived from a stable string key.
function patternFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xff;
  return h | 0b1; // never fully dark
}

export function JobConsole(p: Props) {
  const [brandId, setBrandId] = useState(p.brands[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [composing, setComposing] = useState(false);
  const busy = p.detecting != null || p.running;

  return (
    <>
      {/* ---- Incoming jobs + compose, as a dot-matrix card grid ---- */}
      <section aria-label="Incoming jobs">
        <div className="seclab">
          <b>incoming jobs</b>
          <span className="hint">run the detector to surface cross-trade opportunities</span>
        </div>

        <div className="opp-grid">
          {p.jobs.map((j) => {
            const scanning = p.detecting === j.id;
            return (
              <div key={j.id} className="opp">
                <div className="opp-h">
                  <span className="trade">{j.trade.replace(/_/g, " ")}</span>
                  <DotGrid count={8} cols={4} pattern={patternFor(j.id)} />
                </div>
                <div className="opp-job">
                  {p.brandName(j.brandId)} · {j.location}
                </div>
                <div className="opp-note">{j.summary}</div>
                <div className="opp-note" style={{ color: "var(--faint)", marginTop: 6 }}>
                  &ldquo;{j.techNotes}&rdquo;
                </div>
                <div className="opp-cta">
                  <DotGrid count={8} cols={4} pattern={scanning ? 0xff : patternFor(j.summary)} />
                  <button type="button" className="btn" disabled={busy} onClick={() => p.onDetectSeeded(j)}>
                    <IconScan size={14} />
                    {scanning ? "Scanning…" : "Run detector"}
                  </button>
                </div>
              </div>
            );
          })}

          {/* ---- Dashed compose-a-job card ---- */}
          <div className="opp compose" id="compose-card">
            {composing ? (
              <div className="composer">
                <div className="composer-lab">
                  <IconPen size={13} /> compose a completed job
                </div>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  disabled={busy}
                  aria-label="Performing brand"
                  className="field"
                >
                  {p.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.trade})
                    </option>
                  ))}
                </select>
                <textarea
                  id="compose-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={busy}
                  rows={3}
                  placeholder="What did the tech jot down? e.g. 'Finished an AC tune-up — the breaker panel was scorched and hot to the touch.'"
                  className="field"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-teal"
                  disabled={busy || !notes.trim()}
                  onClick={() => p.onDetectCustom(brandId, notes)}
                >
                  <IconScan size={14} />
                  {p.detecting === "custom" ? "Scanning…" : "Run detector"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setComposing(true)}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  color: "inherit",
                  padding: 8,
                }}
              >
                <DotGrid count={10} cols={5} pattern={0b0101011010} />
                <span className="compose-title">compose a job</span>
                <span className="compose-sub">type a tech&rsquo;s note → watch the detector</span>
              </button>
            )}
          </div>
        </div>

        {p.noOppNote && (
          <div
            style={{ marginTop: 12, fontSize: 13, color: "var(--mut)", display: "flex", alignItems: "center", gap: 8 }}
          >
            <IconNo size={15} /> {p.noOppNote}
          </div>
        )}
      </section>

      {/* ---- Detected opportunities ---- */}
      {p.opportunities.length > 0 && (
        <section aria-label="Opportunities found">
          <div className="seclab">
            <b>
              detected opportunities{" "}
              <span className="mono" style={{ color: "var(--acc)" }}>
                {p.opportunities.length}
              </span>
            </b>
            <div className="epsilon-knob">
              <IconTune size={15} />
              <span className="lab">
                route threshold <span className="mono">ε</span>
              </span>
              <input
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={p.epsilon}
                disabled={p.running}
                onChange={(e) => p.onEpsilon(Number(e.target.value))}
                aria-label="Epsilon route threshold"
              />
              <span className="val mono">{p.epsilon.toFixed(2)}</span>
            </div>
          </div>

          <div className="opp-grid">
            {p.opportunities.map((o) => {
              const tradeLabel = o.trade.replace(/_/g, " ");
              const routing = p.routingId === o.id;
              return (
                <div key={o.id} className="opp">
                  <div className="opp-h">
                    <span className="trade">{tradeLabel}</span>
                    <span className="badge auto">opportunity</span>
                  </div>
                  <div className="opp-job" style={{ textTransform: "capitalize" }}>
                    {o.brandName} → {tradeLabel}
                  </div>
                  <div className="opp-note">{o.rationale}</div>
                  <div className="opp-cta">
                    <DotGrid count={8} cols={4} pattern={routing ? 0xff : patternFor(o.id)} />
                    <button
                      type="button"
                      className="btn btn-teal"
                      disabled={p.running}
                      onClick={() => p.onRoute(o)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      <IconSend size={14} />
                      {routing ? "Routing…" : "Route this"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
