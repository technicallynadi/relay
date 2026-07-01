// Live KPI strip — computed from the session's real activity, never hardcoded.
// DotGothic16 numbers in dot-matrix cards; neutral sublines (no vanity ▲ stats).
interface Props {
  detected: number; // cross-trade opportunities surfaced this session
  autoCount: number; // routed runs that cleared the jury gate
  escalatedCount: number; // routed runs gated to a human
  avgSeconds: number | null; // measured avg time-to-route, null until a route runs
}

export function KpiRow({ detected, autoCount, escalatedCount, avgSeconds }: Props) {
  const routed = autoCount + escalatedCount;
  const autoPct = routed > 0 ? Math.round((100 * autoCount) / routed) : null;

  const cards = [
    { k: "detected · session", v: String(detected), d: "cross-trade signals" },
    {
      k: "routed · session",
      v: String(routed),
      d: routed === 0 ? "none yet" : `${autoCount} auto · ${escalatedCount} gated`,
    },
    {
      k: "auto-routed",
      v: autoPct == null ? "—" : `${autoPct}%`,
      d: autoPct == null ? "jury gate" : `${100 - autoPct}% to a human`,
    },
    {
      k: "avg time to route",
      v: avgSeconds == null ? "—" : `${avgSeconds.toFixed(1)}s`,
      d: avgSeconds == null ? "measured live" : "measured",
    },
  ];

  return (
    <div className="kpis">
      {cards.map((kpi) => (
        <div className="kpi" key={kpi.k}>
          <div className="k">{kpi.k}</div>
          <div className="v">{kpi.v}</div>
          <div className="d flat">{kpi.d}</div>
        </div>
      ))}
    </div>
  );
}
