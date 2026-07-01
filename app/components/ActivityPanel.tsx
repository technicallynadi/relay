"use client";

import { useEffect, useState } from "react";

// The session's routed-referral audit feed (most-recent-first). Empty until the
// operator routes an opportunity from the Detect view.

type Decision = "auto_route_eligible" | "escalated" | "declined";

interface Referral {
  id: string;
  trade: string;
  partner: string | null;
  decision: Decision;
  action: string | null;
  outcome: string | null;
  agreement: number | null;
  createdAt: string;
}

const DECISION: Record<Decision, { label: string; cls: string }> = {
  auto_route_eligible: { label: "auto-routed", cls: "auto" },
  escalated: { label: "escalated", cls: "esc" },
  declined: { label: "declined", cls: "muted" },
};

function tradeLabel(trade: string): string {
  return trade.replace(/_/g, " ");
}

// Short relative time, falling back to HH:MM for older entries.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(then).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ActivityPanel() {
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/activity")
      .then((r) => {
        if (!r.ok) throw new Error(`activity ${r.status}`);
        return r.json() as Promise<{ referrals: Referral[] }>;
      })
      .then((d) => {
        if (live) setReferrals(d.referrals);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section aria-label="Routed referrals">
      <div className="seclab">
        <b>activity</b>
        <span className="hint">routed referrals · most recent first</span>
      </div>

      {error ? (
        <div className="error-banner">Couldn&rsquo;t load the activity feed.</div>
      ) : referrals === null ? (
        <div className="idle">
          <span className="idle-title">Loading activity…</span>
          <span className="idle-sub">Reading the routed-referral log.</span>
        </div>
      ) : referrals.length === 0 ? (
        <div className="idle">
          <span className="idle-title">No referrals routed yet</span>
          <span className="idle-sub">Route an opportunity and it&rsquo;ll show up here.</span>
        </div>
      ) : (
        <div className="opp-grid">
          {referrals.map((r) => {
            const dec = DECISION[r.decision] ?? DECISION.declined;
            const detail = r.outcome ?? r.action;
            return (
              <article key={r.id} className="opp">
                <div className="opp-h">
                  <span className="trade">{tradeLabel(r.trade).toUpperCase()}</span>
                  <span className={`badge ${dec.cls}`}>{dec.label}</span>
                </div>

                <div className="opp-job">{r.partner ?? "—"}</div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 6,
                  }}
                >
                  {r.agreement != null && (
                    <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
                      W {r.agreement.toFixed(2)}
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                    {timeAgo(r.createdAt)}
                  </span>
                </div>

                {detail && <div className="opp-note">{detail}</div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
