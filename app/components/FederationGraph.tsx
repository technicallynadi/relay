"use client";

import type { BrandOpt } from "./JobConsole";
import type { RunState } from "./runState";

export interface AdjEdge {
  fromTrade: string;
  toTrade: string;
  weight: number;
}

interface Props {
  state: RunState;
  brands: BrandOpt[];
  adjacency: AdjEdge[];
}

const CX = 250;
const CY = 215;
const R = 140;
const NR = 20;
const PX = 600;
const PW = 280;
const pY = (i: number) => 66 + i * 58;

export function FederationGraph({ state, brands, adjacency }: Props) {
  const originTrade = state.job?.trade ?? null;
  const targetTrade = state.detection?.trade ?? null;

  const set = new Set<string>();
  for (const e of adjacency) {
    set.add(e.fromTrade);
    set.add(e.toTrade);
  }
  if (originTrade) set.add(originTrade);
  const trades = [...set];

  const pos = new Map<string, { x: number; y: number; a: number }>();
  trades.forEach((t, i) => {
    const a = (-90 + (i * 360) / trades.length) * (Math.PI / 180);
    pos.set(t, { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), a });
  });

  const brandName = (t: string) => brands.find((b) => b.trade === t)?.name ?? "";
  const consensusId = state.committee?.consensusPartnerId ?? null;
  const split = state.committee?.split ?? null;
  const tp = targetTrade ? pos.get(targetTrade) ?? null : null;
  const partners = state.candidates.slice(0, 5);
  const activeEdge = (e: AdjEdge) =>
    !!originTrade && !!targetTrade && e.fromTrade === originTrade && e.toTrade === targetTrade;

  return (
    <section className="panel" aria-label="Federated network">
      <div className="panel-head">
        <h2>Federated network</h2>
        <span className="hint">brand-capability subgraph + local partners · retrieval lights the path</span>
      </div>
      <div className="panel-body">
        <svg
          viewBox="0 0 920 440"
          width="100%"
          role="img"
          aria-label="Federated graph: trades linked by cross-trade adjacency edges, merged with the retrieved local partners."
        >
          {adjacency.map((e, i) => {
            const a = pos.get(e.fromTrade);
            const b = pos.get(e.toTrade);
            if (!a || !b) return null;
            const on = activeEdge(e);
            return (
              <line
                key={`e${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={on ? "var(--teal)" : "var(--border-strong)"}
                strokeWidth={on ? 3 : 1}
                opacity={on ? 1 : 0.45}
              />
            );
          })}

          {tp &&
            partners.map((c, i) => (
              <line
                key={`pl${c.partner.id}`}
                x1={tp.x}
                y1={tp.y}
                x2={PX - 6}
                y2={pY(i)}
                stroke="var(--border-strong)"
                strokeWidth={1}
                opacity={0.55}
              />
            ))}

          {trades.map((t) => {
            const p = pos.get(t)!;
            const isOrigin = t === originTrade;
            const isTarget = t === targetTrade;
            const ring = isOrigin ? "var(--amber)" : isTarget ? "var(--teal)" : "var(--border-strong)";
            const fill = isOrigin ? "var(--amber-dim)" : isTarget ? "var(--teal-dim)" : "var(--surface-raised)";
            const cos = Math.cos(p.a);
            const lx = CX + (R + 22) * cos;
            const ly = CY + (R + 22) * Math.sin(p.a);
            const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
            const dx = anchor === "start" ? 4 : anchor === "end" ? -4 : 0;
            return (
              <g key={t}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={NR}
                  fill={fill}
                  stroke={ring}
                  strokeWidth={isOrigin || isTarget ? 2.5 : 1}
                />
                <text
                  x={lx + dx}
                  y={ly}
                  textAnchor={anchor}
                  fontSize="11"
                  fill="var(--text)"
                  style={{ textTransform: "capitalize" }}
                >
                  {t.replace(/_/g, " ")}
                </text>
                {(isOrigin || isTarget) && brandName(t) && (
                  <text x={lx + dx} y={ly + 11} textAnchor={anchor} fontSize="9" fill="var(--muted)">
                    {brandName(t)}
                  </text>
                )}
              </g>
            );
          })}

          {tp &&
            partners.map((c, i) => {
              const won = c.partner.id === consensusId;
              const disputed =
                !!split && (c.partner.id === split.partnerAId || c.partner.id === split.partnerBId);
              const ring = won ? "var(--teal)" : disputed ? "var(--amber)" : "var(--border-strong)";
              return (
                <g key={c.partner.id}>
                  <rect
                    x={PX}
                    y={pY(i) - 17}
                    width={PW}
                    height={34}
                    rx={6}
                    fill="var(--surface-raised)"
                    stroke={ring}
                    strokeWidth={won || disputed ? 2 : 1}
                  />
                  <text x={PX + 12} y={pY(i) - 2} fontSize="11.5" fill="var(--text)">
                    {c.partner.name}
                  </text>
                  <text x={PX + 12} y={pY(i) + 11} fontSize="9.5" fill="var(--muted)">
                    {c.partner.brandId ? "in-network" : "local"} · fit {c.subScores.fit.toFixed(2)} · prox{" "}
                    {c.subScores.proximity.toFixed(2)}
                  </text>
                </g>
              );
            })}

          <text x={CX} y={420} textAnchor="middle" fontSize="10" fill="var(--faint)">
            brand-capability subgraph
          </text>
          {tp && partners.length > 0 && (
            <text x={PX + PW / 2} y={420} textAnchor="middle" fontSize="10" fill="var(--faint)">
              local partner graph (retrieved)
            </text>
          )}
        </svg>

        {!state.job && (
          <p style={{ margin: "4px 2px 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
            The engine queries a <b style={{ color: "var(--text)" }}>federated graph</b> — Neighborly&rsquo;s
            brand-capability subgraph (the trades above, linked by cross-trade adjacency edges) merged with a live
            local-partner graph. Route an opportunity and the path lights up: origin trade → adjacency edge → target
            trade → the partners pulled for it.
          </p>
        )}
      </div>
    </section>
  );
}
