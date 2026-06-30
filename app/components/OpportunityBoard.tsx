"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DotGrid } from "./DotGrid";
import { IconPen, IconScan, IconTune } from "./icons";
import type { BrandOpt } from "./JobConsole";

// A decided opportunity row from GET /api/board. The decision the server sent is
// advisory only — the board re-decides every card live against the operator's ε
// (see `decisionFor`), so dragging the trust dial re-routes the whole grid.
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
  delta: number | null;
  epsilon: number;
}

export type BoardDecision = "auto" | "escalated" | "declined";

export interface BoardStats {
  detected: number;
  auto: number;
  escalated: number;
}

interface Props {
  brands: BrandOpt[];
  epsilon: number;
  running: boolean;
  /** jobId of the card currently being routed through the live committee. */
  routingJobId: string | null;
  /** jobIds the human gate has already sent — flips the badge to "sent ✓". */
  sentJobIds: Set<string>;
  onEpsilon: (v: number) => void;
  onDrillIn: (opp: BoardOpportunity) => void;
  onSend: (opp: BoardOpportunity) => void;
  onCompose: (brandId: string, techNotes: string) => void;
  onStats: (stats: BoardStats) => void;
  /** registers an opener so "+ new scan" / the top-bar field can expand the composer. */
  registerComposeOpener?: (open: () => void) => void;
}

const REVEAL_INTERVAL_MS = 2400;

// The board's single source of truth for a card's decision: declined when there's
// no cross-trade target, else δ<ε auto-routes and δ≥ε escalates to a human.
function decisionFor(opp: BoardOpportunity, epsilon: number): BoardDecision {
  if (opp.trade == null || opp.delta == null) return "declined";
  return opp.delta < epsilon ? "auto" : "escalated";
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
  const [revealed, setRevealed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Load the decided board once on mount.
  useEffect(() => {
    let alive = true;
    fetch("/api/board")
      .then((r) => r.json())
      .then((d: { opportunities?: BoardOpportunity[] }) => {
        if (!alive) return;
        setAll(d.opportunities ?? []);
        // Reveal the first card immediately so the feed never opens empty.
        setRevealed(d.opportunities?.length ? 1 : 0);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = all.length;
  const caughtUp = total > 0 && revealed >= total;

  // The live feed tick: reveal one more card every interval until caught up.
  useEffect(() => {
    if (paused || caughtUp || total === 0) return;
    const id = window.setInterval(() => {
      setRevealed((n) => (n >= total ? n : n + 1));
    }, REVEAL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, caughtUp, total]);

  const visible = useMemo(() => all.slice(0, revealed), [all, revealed]);

  // Report live stats up whenever the revealed set or ε changes — computed from the
  // REVEALED cards under the live ε decision, so the KPI row tracks the trust dial.
  const stats = useMemo<BoardStats>(() => {
    let auto = 0;
    let escalated = 0;
    for (const opp of visible) {
      const d = decisionFor(opp, p.epsilon);
      if (d === "auto") auto++;
      else if (d === "escalated") escalated++;
    }
    return { detected: visible.length, auto, escalated };
  }, [visible, p.epsilon]);

  const onStats = p.onStats;
  useEffect(() => {
    onStats(stats);
  }, [stats, onStats]);

  const restart = useCallback(() => {
    setRevealed(total > 0 ? 1 : 0);
    setPaused(false);
  }, [total]);

  const clearFeed = useCallback(() => {
    setRevealed(0);
    setPaused(true);
  }, []);

  const feedLabel =
    revealed === 0 ? "cleared" : caughtUp ? "feed caught up" : paused ? "paused" : "jobs arriving…";

  return (
    <section aria-label="Live opportunity feed">
      {/* ---- Feed control row + ε trust dial ---- */}
      <div className="seclab">
        <div className="feed-ctl">
          <span className={`feed-pulse${paused || caughtUp ? " off" : ""}`} aria-hidden="true" />
          <span className="feed-state">{feedLabel}</span>
          <span className="feed-count mono">
            {revealed}/{total}
          </span>
          <button
            type="button"
            className="feed-btn"
            onClick={() => setPaused((v) => !v)}
            disabled={caughtUp}
          >
            {paused ? "▶ start" : "⏸ stop"}
          </button>
          <button type="button" className="feed-btn" onClick={restart}>
            ↻ restart
          </button>
          <button
            type="button"
            className="feed-btn"
            onClick={clearFeed}
            disabled={revealed === 0}
          >
            ✕ clear
          </button>
        </div>
        <div className="epsilon-knob">
          <IconTune size={15} />
          <span className="lab">
            tolerance <span className="mono">ε</span>
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

      <div style={{ fontSize: 12, color: "var(--mut)", margin: "2px 2px 14px", lineHeight: 1.55 }}>
        <b className="mono" style={{ color: "var(--ink)" }}>
          δ
        </b>{" "}
        = how much the judges disagree on the best partner ·{" "}
        <b className="mono" style={{ color: "var(--amber)" }}>
          ε
        </b>{" "}
        = how much disagreement we allow before a human reviews ·{" "}
        <span style={{ color: "var(--acc)" }}>auto-routes when δ &lt; ε</span>, otherwise it escalates to
        a person.
      </div>

      {loadError && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--mut)" }}>
          The board is unavailable right now.
        </div>
      )}

      <div className="opp-grid">
        {visible.map((opp) => (
          <OpportunityCard
            key={opp.jobId}
            opp={opp}
            epsilon={p.epsilon}
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
  epsilon: number;
  routing: boolean;
  sent: boolean;
  onDrillIn: (opp: BoardOpportunity) => void;
  onSend: (opp: BoardOpportunity) => void;
}

function OpportunityCard({ opp, epsilon, routing, sent, onDrillIn, onSend }: CardProps) {
  const decision = decisionFor(opp, epsilon);
  const declined = decision === "declined";

  // δ on a 0–1 scale → meter fill width; ε marker rides the same axis.
  const fillPct = opp.delta == null ? 0 : Math.max(0, Math.min(1, opp.delta)) * 100;
  const markPct = Math.max(0, Math.min(1, epsilon)) * 100;

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
        {opp.delta != null && (
          <div className="delta mono">
            δ <b>{opp.delta.toFixed(2)}</b>
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
