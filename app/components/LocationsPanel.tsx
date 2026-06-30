"use client";

import { useEffect, useMemo, useState } from "react";

// The Neighborly footprint: 19 brands across the service area, grouped by trade.
// Sourced from the same /api/jobs roster the compose dropdown uses.

interface Brand {
  id: string;
  name: string;
  trade: string;
}

function tradeLabel(trade: string): string {
  return trade.replace(/_/g, " ");
}

export function LocationsPanel() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/jobs")
      .then((r) => {
        if (!r.ok) throw new Error(`jobs ${r.status}`);
        return r.json() as Promise<{ brands: Brand[] }>;
      })
      .then((d) => {
        if (live) setBrands(d.brands);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Group brands by trade so each trade gets a small subhead above its cards.
  const grouped = useMemo(() => {
    if (!brands) return [];
    const byTrade = new Map<string, Brand[]>();
    for (const b of brands) {
      const list = byTrade.get(b.trade) ?? [];
      list.push(b);
      byTrade.set(b.trade, list);
    }
    return Array.from(byTrade.entries());
  }, [brands]);

  return (
    <section aria-label="Locations">
      <div className="seclab">
        <b>locations</b>
        <span className="hint">Neighborly — 19 brands · 4,000+ locations</span>
      </div>

      {/* service-area card */}
      <article className="opp" style={{ marginBottom: 18 }}>
        <div className="opp-h">
          <span className="trade">SERVICE AREA</span>
          <span className="badge auto">active</span>
        </div>
        <div className="opp-job">Plano, TX</div>
        <div className="opp-note">
          Cross-trade referrals route within the local Plano footprint — every brand
          below shares the service area.
        </div>
      </article>

      {error ? (
        <div className="error-banner">Couldn&rsquo;t load the brand roster.</div>
      ) : brands === null ? (
        <div className="idle">
          <span className="idle-title">Loading brands…</span>
          <span className="idle-sub">Reading the Neighborly franchise roster.</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="idle">
          <span className="idle-title">No brands in the roster</span>
          <span className="idle-sub">The franchise roster came back empty.</span>
        </div>
      ) : (
        grouped.map(([trade, list]) => (
          <div key={trade} style={{ marginBottom: 18 }}>
            <div className="seclab" style={{ marginBottom: 11 }}>
              <b style={{ letterSpacing: "0.1em" }}>{tradeLabel(trade)}</b>
              <span className="hint mono">{list.length}</span>
            </div>
            <div className="opp-grid">
              {list.map((b) => (
                <article key={b.id} className="opp">
                  <div className="opp-h">
                    <span className="trade">{tradeLabel(b.trade).toUpperCase()}</span>
                  </div>
                  <div className="opp-job">{b.name}</div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
