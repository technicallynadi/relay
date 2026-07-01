"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DotGrid } from "./DotGrid";
import { IconPen, IconScan, IconTune } from "./icons";
import type { BrandOpt } from "./JobConsole";

// A decided opportunity row from the live feed (GET /api/incoming). The server's decision
// is advisory — the board re-decides every card live against the operator's required-agreement
// dial (see `decisionFor`), so dragging it re-routes the whole grid.
export interface BoardOpportunity {
  jobId: string;
  brandId: string;
  brand: string;
  fromTrade: string;
  trade: string | null;
  location: string;
  summary: string;
  techNotes: string;
  partner: string | null;
  agreement: number | null; // jury concordance (Kendall's W)
  margin: number | null; // Borda winner's lead over the runner-up
  minAgreement: number; // the server's default threshold
}

export type BoardDecision = "auto" | "escalated" | "declined";

export interface BoardStats {
  detected: number;
  auto: number;
  escalated: number;
}

interface Props {
  brands: BrandOpt[];
  minAgreement: number;
  running: boolean;
  /** jobId of the card currently being routed through the live committee. */
  routingJobId: string | null;
  /** jobIds the human gate has already sent — flips the badge to "sent ✓". */
  sentJobIds: Set<string>;
  onMinAgreement: (v: number) => void;
  onDrillIn: (opp: BoardOpportunity) => void;
  onSend: (opp: BoardOpportunity) => void;
  onCompose: (brandId: string, techNotes: string) => void;
  onStats: (stats: BoardStats) => void;
  /** registers an opener so "+ new scan" / the top-bar field can expand the composer. */
  registerComposeOpener?: (open: () => void) => void;
}

const POLL_INTERVAL_MS = 2000; // how often the board pulls the live feed
const MARGIN_FLOOR = 0.15; // the Borda winner must clear the runner-up by this much

// The board's single source of truth for a card's decision: declined when there's no
// cross-trade target, else auto-route when the jury's agreement clears the required bar
// AND the top pick is clear enough — otherwise escalate to a human.
function decisionFor(opp: BoardOpportunity, minAgreement: number): BoardDecision {
  if (opp.trade == null || opp.agreement == null) return "declined";
  return opp.agreement >= minAgreement && (opp.margin ?? 0) >= MARGIN_FLOOR ? "auto" : "escalated";
}

// A stable dot-pattern per card so the matrix glyph varies but never flickers.
function patternFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xff;
  return h | 0b1;
}

function tradeLabel(trade: string | null): string {
  return (trade ?? "").replace(/_/g, " ").toUpperCase();
}

export function OpportunityBoard(p: Props) {
  const [all, setAll] = useState<BoardOpportunity[]>([]);
  const [paused, setPaused] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);

  // Pull the live feed. The ingestion worker POSTs freshly-pulled jobs to /api/incoming;
  // we render the whole feed (newest first) and it grows as jobs stream in.
  const load = useCallback(() => {
    fetch("/api/incoming")
      .then((r) => r.json())
      .then((d: { opportunities?: BoardOpportunity[] }) => {
        setAll(d.opportunities ?? []);
        setEverLoaded(true);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  // Poll on an interval while live; stop hitting the endpoint when paused.
  useEffect(() => {
    if (paused) return;
    load();
    const id = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, load]);

  const total = all.length;

  // Report live stats up whenever the feed or the required-agreement dial changes — computed
  // over the whole live feed under the current decision, so the KPI row tracks it.
  const stats = useMemo<BoardStats>(() => {
    let auto = 0;
    let escalated = 0;
    for (const opp of all) {
      const d = decisionFor(opp, p.minAgreement);
      if (d === "auto") auto++;
      else if (d === "escalated") escalated++;
    }
    return { detected: all.length, auto, escalated };
  }, [all, p.minAgreement]);

  const onStats = p.onStats;
  useEffect(() => {
    onStats(stats);
  }, [stats, onStats]);

  // Restart: wipe the feed on the server (it re-seeds the demo baseline) and stay live, so
  // the board repopulates and keeps filling.
  const restart = useCallback(async () => {
    await fetch("/api/incoming", { method: "DELETE" }).catch(() => {});
    setAll([]);
    setPaused(false);
    load();
  }, [load]);

  // Clear: empty the feed and hold it. The server re-seeds the baseline on the next pull
  // (when you press start again).
  const clearFeed = useCallback(async () => {
    await fetch("/api/incoming", { method: "DELETE" }).catch(() => {});
    setAll([]);
    setPaused(true);
  }, []);

  const feedLabel = paused
    ? "paused"
    : total === 0
      ? everLoaded
        ? "cleared"
        : "connecting…"
      : "jobs arriving…";

  return (
    <section aria-label="Live opportunity feed">
      {/* ---- Feed control row + required-agreement dial ---- */}
      <div className="seclab">
        <div className="feed-ctl">
          <span className={`feed-pulse${paused ? " off" : ""}`} aria-hidden="true" />
          <span className="feed-state">{feedLabel}</span>
          <span className="feed-count mono">{total}</span>
          <button type="button" className="feed-btn" onClick={() => setPaused((v) => !v)}>
            {paused ? "▶ start" : "⏸ stop"}
          </button>
          <button type="button" className="feed-btn" onClick={restart}>
            ↻ restart
          </button>
          <button type="button" className="feed-btn" onClick={clearFeed} disabled={total === 0}>
            ✕ clear
          </button>
        </div>
        <div className="agreement-knob">
          <IconTune size={15} />
          <span className="lab">required agreement</span>
          <input
            type="range"
            min={0.01}
            max={1}
            step={0.01}
            value={p.minAgreement}
            disabled={p.running}
            onChange={(e) => p.onMinAgreement(Number(e.target.value))}
            aria-label="Required jury agreement to auto-route"
          />
          <span className="val mono">{p.minAgreement.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--mut)", margin: "2px 2px 14px", lineHeight: 1.55 }}>
        <b className="mono" style={{ color: "var(--ink)" }}>
          W
        </b>{" "}
        = how much the jury agrees on the ranking (Kendall&rsquo;s W, 0–1) ·{" "}
        <b className="mono" style={{ color: "var(--amber)" }}>
          required agreement
        </b>{" "}
        = the bar the jury must clear ·{" "}
        <span style={{ color: "var(--acc)" }}>auto-routes when W ≥ the bar</span> (with a clear top pick),
        otherwise it escalates to a person.
      </div>

      {loadError && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--mut)" }}>
          The board is unavailable right now.
        </div>
      )}

      <div className="opp-grid">
        {all.map((opp) => (
          <OpportunityCard
            key={opp.jobId}
            opp={opp}
            minAgreement={p.minAgreement}
            routing={p.routingJobId === opp.jobId}
            sent={p.sentJobIds.has(opp.jobId)}
            onDrillIn={p.onDrillIn}
            onSend={p.onSend}
          />
        ))}

        <ComposeCard
          brands={p.brands}
          busy={p.running}
          onCompose={p.onCompose}
          registerOpener={p.registerComposeOpener}
        />
      </div>
    </section>
  );
}

interface CardProps {
  opp: BoardOpportunity;
  minAgreement: number;
  routing: boolean;
  sent: boolean;
  onDrillIn: (opp: BoardOpportunity) => void;
  onSend: (opp: BoardOpportunity) => void;
}

function OpportunityCard({ opp, minAgreement, routing, sent, onDrillIn, onSend }: CardProps) {
  const decision = decisionFor(opp, minAgreement);
  const declined = decision === "declined";

  // Jury agreement W on a 0–1 scale → meter fill; the required-agreement marker rides the same axis.
  const fillPct = opp.agreement == null ? 0 : Math.max(0, Math.min(1, opp.agreement)) * 100;
  const markPct = Math.max(0, Math.min(1, minAgreement)) * 100;

  const badge = sent
    ? { cls: "sent", text: "sent ✓" }
    : decision === "auto"
      ? { cls: "auto", text: "auto-route" }
      : decision === "escalated"
        ? { cls: "esc", text: "escalated" }
        : { cls: "muted", text: "declined" };

  const cta = sent
    ? { cls: "mut", text: "accepted" }
    : decision === "auto"
      ? { cls: "", text: "send →" }
      : decision === "escalated"
        ? { cls: "esc", text: "review →" }
        : { cls: "mut", text: "no referral" };

  const handleClick = () => {
    if (declined || sent) return;
    if (decision === "auto") onSend(opp);
    else onDrillIn(opp);
  };

  return (
    <button
      type="button"
      className={`opp opp-card${decision === "escalated" && !sent ? " sel" : ""}`}
      onClick={handleClick}
      disabled={declined || routing}
      aria-label={`${opp.brand} ${opp.location} — ${badge.text}`}
    >
      <div className="opp-h">
        <span className="trade">{declined ? tradeLabel(opp.fromTrade) : tradeLabel(opp.trade)}</span>
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
      </div>

      <div className="opp-job">
        {opp.brand} · {opp.location}
      </div>
      <div className="opp-note clamp">{opp.summary}</div>
      <div className="opp-note clamp" style={{ color: "var(--faint)", marginTop: 6 }}>
        &ldquo;{opp.techNotes}&rdquo;
      </div>

      <div className="opp-foot">
        <div className="partner">{opp.partner ?? "—"}</div>
        {opp.agreement != null && (
          <div className="delta mono">
            W <b>{opp.agreement.toFixed(2)}</b>
          </div>
        )}
      </div>

      <div className="mini" aria-hidden="true">
        <div
          className={`mini-f ${decision === "auto" ? "auto" : "esc"}`}
          style={{ width: `${fillPct}%` }}
        />
        <div className="mini-m" style={{ left: `${markPct}%` }} />
      </div>

      <div className="opp-cta">
        <DotGrid count={8} cols={4} pattern={routing ? 0xff : patternFor(opp.jobId)} />
        <span className={`a ${cta.cls}`}>{routing ? "routing…" : cta.text}</span>
      </div>
    </button>
  );
}

interface ComposeProps {
  brands: BrandOpt[];
  busy: boolean;
  onCompose: (brandId: string, techNotes: string) => void;
  registerOpener?: (open: () => void) => void;
}

function ComposeCard({ brands, busy, onCompose, registerOpener }: ComposeProps) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [composing, setComposing] = useState(false);

  // Keep the brand select valid once brands load.
  useEffect(() => {
    if (!brandId && brands[0]) setBrandId(brands[0].id);
  }, [brands, brandId]);

  // Expose an opener so the top-bar "+ new scan" can expand + focus this composer.
  useEffect(() => {
    if (!registerOpener) return;
    registerOpener(() => {
      setComposing(true);
      window.setTimeout(() => document.getElementById("compose-notes")?.focus(), 60);
    });
  }, [registerOpener]);

  return (
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
            {brands.map((b) => (
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
          />
          <button
            type="button"
            className="btn btn-teal"
            disabled={busy || !notes.trim()}
            onClick={() => onCompose(brandId, notes)}
          >
            <IconScan size={14} />
            run detector
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
  );
}
