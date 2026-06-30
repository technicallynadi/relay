"use client";

import { useEffect, useMemo, useState } from "react";

// The partner directory behind the Google-Places adapter seam: in-network brands
// (federated graph) + local out-of-network providers. Read-only browse surface.

type Capacity = "open_today" | "this_week" | "backlogged";

interface Partner {
  id: string;
  name: string;
  trade: string;
  inNetwork: boolean;
  rating: number;
  reviewCount: number;
  capacity: Capacity;
  specialties: string[];
  summary: string;
}

const CAPACITY: Record<Capacity, { label: string; cls: string }> = {
  open_today: { label: "open today", cls: "auto" },
  this_week: { label: "this week", cls: "muted" },
  backlogged: { label: "backlogged", cls: "amber" },
};

function tradeLabel(trade: string): string {
  return trade.replace(/_/g, " ");
}

export function PartnersPanel() {
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [error, setError] = useState(false);
  const [activeTrade, setActiveTrade] = useState<string>("all");

  useEffect(() => {
    let live = true;
    fetch("/api/partners")
      .then((r) => {
        if (!r.ok) throw new Error(`partners ${r.status}`);
        return r.json() as Promise<{ partners: Partner[] }>;
      })
      .then((d) => {
        if (live) setPartners(d.partners);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const trades = useMemo(() => {
    if (!partners) return [];
    return Array.from(new Set(partners.map((p) => p.trade)));
  }, [partners]);

  const shown = useMemo(() => {
    if (!partners) return [];
    return activeTrade === "all"
      ? partners
      : partners.filter((p) => p.trade === activeTrade);
  }, [partners, activeTrade]);

  return (
    <section aria-label="Partner directory">
      <div className="seclab">
        <b>partners</b>
        <span className="hint">
          in-network brands · local providers · sorted by capacity
        </span>
      </div>

      {/* trade filter tabs */}
      {trades.length > 0 && (
        <div className="seclab" style={{ marginBottom: 16 }}>
          <div className="tabs" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              className={`tab${activeTrade === "all" ? " on" : ""}`}
              style={tabStyle(activeTrade === "all")}
              onClick={() => setActiveTrade("all")}
            >
              all
            </button>
            {trades.map((t) => (
              <button
                key={t}
                type="button"
                className={`tab${activeTrade === t ? " on" : ""}`}
                style={tabStyle(activeTrade === t)}
                onClick={() => setActiveTrade(t)}
              >
                {tradeLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="error-banner">Couldn&rsquo;t load the partner directory.</div>
      ) : partners === null ? (
        <div className="idle">
          <span className="idle-title">Loading partners…</span>
          <span className="idle-sub">Pulling the directory behind the places adapter.</span>
        </div>
      ) : shown.length === 0 ? (
        <div className="idle">
          <span className="idle-title">No partners in this trade</span>
          <span className="idle-sub">Switch the filter to see the full directory.</span>
        </div>
      ) : (
        <div className="opp-grid">
          {shown.map((p) => {
            const cap = CAPACITY[p.capacity] ?? CAPACITY.this_week;
            return (
              <article key={p.id} className="opp">
                <div className="opp-h">
                  <span className="trade">{tradeLabel(p.trade).toUpperCase()}</span>
                  <span className={`badge ${p.inNetwork ? "auto" : "muted"}`}>
                    {p.inNetwork ? "in-network" : "local"}
                  </span>
                </div>

                <div className="opp-job">{p.name}</div>

                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--mut)",
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>
                    <span style={{ color: "var(--amber)" }}>★</span> {p.rating.toFixed(1)} ·{" "}
                    {p.reviewCount} reviews
                  </span>
                  <span className={`badge ${cap.cls}`}>{cap.label}</span>
                </div>

                {p.specialties.length > 0 && (
                  <div className="chip-row" style={{ marginTop: 11 }}>
                    {p.specialties.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="opp-note" style={{ marginTop: 11 }}>
                  {p.summary}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// The seclab .tabs/.tab classes aren't defined in globals.css, so style the pills
// inline to match the badge/chip vocabulary (the active one picks up the accent).
function tabStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "4px 11px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--acc-l)" : "var(--line-2)"}`,
    background: active ? "var(--acc-d)" : "transparent",
    color: active ? "var(--acc)" : "var(--mut)",
    cursor: active ? "default" : "pointer",
  };
}
