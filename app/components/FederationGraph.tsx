"use client";

import { useState } from "react";
import type { BrandOpt } from "./JobConsole";
import type { RunState } from "./runState";

export interface AdjEdge {
  fromTrade: string;
  toTrade: string;
  weight: number;
  rationale: string;
}

interface Props {
  state: RunState;
  brands: BrandOpt[];
  adjacency: AdjEdge[];
}

// Radial graph geometry (upper-left cluster).
const CX = 232;
const CY = 172;
const R = 118;
const NR = 18;

// Retrieved-partner list (right column).
const PX = 600;
const PW = 300;
const ROW_H = 62;
const pY = (i: number) => 68 + i * ROW_H; // leaves a clear band for the column header above card 0

// Geography scatter box (lower-left; revealed during a run).
const GEO = { x: 40, y: 344, w: 372, h: 116, pad: 16 };

const cap = (t: string) => t.replace(/_/g, " ");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Map an edge weight (~0.4–0.9) to a stroke width and opacity so the graph
// reads as a genuinely weighted graph.
const edgeWidth = (w: number) => 0.9 + clamp01((w - 0.4) / 0.5) * 3.1; // 0.9 → 4.0
const edgeOpacity = (w: number) => 0.22 + clamp01((w - 0.4) / 0.5) * 0.5; // 0.22 → 0.72

export function FederationGraph({ state, brands, adjacency }: Props) {
  const originTrade = state.job?.trade ?? null;
  const targetTrade = state.detection?.trade ?? null;

  // Hover targets: an edge index, or a trade node id. Only one at a time.
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [hoverTrade, setHoverTrade] = useState<string | null>(null);

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
  const tp = targetTrade ? (pos.get(targetTrade) ?? null) : null;
  const partners = state.candidates.slice(0, 5);
  const running = !!state.job;

  const activeEdge = (e: AdjEdge) =>
    !!originTrade && !!targetTrade && e.fromTrade === originTrade && e.toTrade === targetTrade;
  const outgoingFromHover = (e: AdjEdge) => !!hoverTrade && e.fromTrade === hoverTrade;

  // Trim each adjacency line back to the node rims so arrowheads land cleanly.
  const trimToRims = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: a.x + ux * NR,
      y1: a.y + uy * NR,
      x2: b.x - ux * (NR + 8), // extra gap leaves room for the arrowhead
      y2: b.y - uy * (NR + 8),
    };
  };

  // Caption text below the graph: hover wins, else the active route, else idle.
  let caption: React.ReactNode = null;
  if (hoverEdge != null && adjacency[hoverEdge]) {
    const e = adjacency[hoverEdge];
    caption = (
      <>
        <tspan fill="var(--teal)">
          {cap(e.fromTrade)} → {cap(e.toTrade)}
        </tspan>
        <tspan fill="var(--muted)">
          {"  ·  "}
          {e.weight.toFixed(2)}
          {"  ·  "}
        </tspan>
        <tspan fill="var(--text)">{e.rationale}</tspan>
      </>
    );
  } else if (hoverTrade) {
    const count = adjacency.filter((e) => e.fromTrade === hoverTrade).length;
    const bn = brandName(hoverTrade);
    caption = (
      <>
        <tspan fill="var(--teal)">{cap(hoverTrade)}</tspan>
        {bn && <tspan fill="var(--text)">{"  ·  " + bn}</tspan>}
        <tspan fill="var(--muted)">
          {"  ·  "}
          {count} cross-trade {count === 1 ? "edge" : "edges"}
        </tspan>
      </>
    );
  } else if (originTrade && targetTrade) {
    const e = adjacency.find((x) => x.fromTrade === originTrade && x.toTrade === targetTrade);
    caption = (
      <>
        <tspan fill="var(--muted)">routing </tspan>
        <tspan fill="var(--teal)">
          {cap(originTrade)} → {cap(targetTrade)}
        </tspan>
        {e && <tspan fill="var(--text)">{"  ·  " + e.rationale}</tspan>}
      </>
    );
  }

  // ---- Geography projection (job + candidate partners → the GEO box) ----
  const geoPts = partners.map((c) => ({
    id: c.partner.id,
    lat: c.partner.lat,
    lng: c.partner.lng,
    name: c.partner.name,
  }));
  const jobLoc = state.job?.location ?? null;
  const allLat = [...geoPts.map((p) => p.lat), ...(jobLoc ? [jobLoc.lat] : [])];
  const allLng = [...geoPts.map((p) => p.lng), ...(jobLoc ? [jobLoc.lng] : [])];
  const showGeo = running && allLat.length > 0;

  let projLng = (_: number) => GEO.x + GEO.w / 2;
  let projLat = (_: number) => GEO.y + GEO.h / 2;
  if (showGeo) {
    const minLat = Math.min(...allLat);
    const maxLat = Math.max(...allLat);
    const minLng = Math.min(...allLng);
    const maxLng = Math.max(...allLng);
    // Pad the span a touch so points never sit on the border; guard zero-span.
    const latSpan = (maxLat - minLat || 0.01) * 1.18;
    const lngSpan = (maxLng - minLng || 0.01) * 1.18;
    const latMid = (minLat + maxLat) / 2;
    const lngMid = (minLng + maxLng) / 2;
    const ix = GEO.x + GEO.pad;
    const iw = GEO.w - GEO.pad * 2;
    const iy = GEO.y + GEO.pad + 6; // headroom for the box label
    const ih = GEO.h - GEO.pad * 2 - 6;
    projLng = (lng: number) => ix + ((lng - (lngMid - lngSpan / 2)) / lngSpan) * iw;
    // latitude increases upward → invert the y axis.
    projLat = (lat: number) => iy + ih - ((lat - (latMid - latSpan / 2)) / latSpan) * ih;
  }
  const jobX = jobLoc ? projLng(jobLoc.lng) : 0;
  const jobY = jobLoc ? projLat(jobLoc.lat) : 0;

  const partnerCaptionRow = (t: string) => (
    <tspan fill="var(--faint)">{t}</tspan>
  );

  return (
    <section className="panel" aria-label="Federated network">
      <div className="panel-head">
        <h2>Federated network</h2>
        <span className="hint">
          weighted brand-capability graph + geography · retrieval lights the path · hover to explore
        </span>
      </div>
      <div className="panel-body">
        <svg
          viewBox="0 0 920 508"
          width="100%"
          role="img"
          aria-label="Federated graph: trades linked by weighted, directed cross-trade adjacency edges, plus a geography scatter of the job and retrieved local partners."
        >
          <defs>
            <marker
              id="fedArrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--border-strong)" />
            </marker>
            <marker
              id="fedArrowLit"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--teal)" />
            </marker>
          </defs>

          <style>{`
            .fed-edge { transition: stroke .18s ease, stroke-width .18s ease, opacity .18s ease; }
            .fed-hit { cursor: pointer; }
            .fed-node { transition: stroke .18s ease, fill .18s ease; cursor: pointer; }
            .fed-card { transition: stroke .18s ease; }
            @media (prefers-reduced-motion: reduce) {
              .fed-edge, .fed-node, .fed-card { transition: none; }
            }
          `}</style>

          {/* ---- weighted + directed adjacency edges ---- */}
          {adjacency.map((e, i) => {
            const a = pos.get(e.fromTrade);
            const b = pos.get(e.toTrade);
            if (!a || !b) return null;
            const lit = activeEdge(e) || hoverEdge === i || outgoingFromHover(e);
            const { x1, y1, x2, y2 } = trimToRims(a, b);
            const w = edgeWidth(e.weight);
            return (
              <g key={`e${i}`}>
                <line
                  className="fed-edge"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={lit ? "var(--teal)" : "var(--border-strong)"}
                  strokeWidth={lit ? Math.max(2.4, w) : w}
                  opacity={lit ? 1 : edgeOpacity(e.weight)}
                  markerEnd={lit ? "url(#fedArrowLit)" : "url(#fedArrow)"}
                />
                {/* fat invisible hit-line makes the edge easy to hover */}
                <line
                  className="fed-hit"
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={14}
                  onMouseEnter={() => {
                    setHoverEdge(i);
                    setHoverTrade(null);
                  }}
                  onMouseLeave={() => setHoverEdge((cur) => (cur === i ? null : cur))}
                >
                  <title>
                    {cap(e.fromTrade)} → {cap(e.toTrade)} · {e.weight.toFixed(2)}
                  </title>
                </line>
              </g>
            );
          })}

          {/* ---- connectors from the target trade to the retrieved partners ---- */}
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
                opacity={0.5}
              />
            ))}

          {/* ---- trade nodes (hoverable to explore) ---- */}
          {trades.map((t) => {
            const p = pos.get(t)!;
            const isOrigin = t === originTrade;
            const isTarget = t === targetTrade;
            const isHover = t === hoverTrade;
            const ring = isOrigin
              ? "var(--amber)"
              : isTarget || isHover
                ? "var(--teal)"
                : "var(--border-strong)";
            const fill = isOrigin
              ? "var(--amber-dim)"
              : isTarget
                ? "var(--teal-dim)"
                : "var(--surface-raised)";
            const cos = Math.cos(p.a);
            const sin = Math.sin(p.a);
            const lx = CX + (R + 22) * cos;
            const ly = CY + (R + 22) * sin;
            const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
            const dx = anchor === "start" ? 4 : anchor === "end" ? -4 : 0;
            // A node sitting straight above the hub has its label directly over the circle —
            // lift the trade name and drop the brand name so neither collides with the node.
            const straightTop = anchor === "middle" && sin < 0;
            const tradeY = straightTop ? ly - 11 : ly;
            const brandY = straightTop ? ly : ly + 11;
            const emphasized = isOrigin || isTarget || isHover;
            return (
              <g
                key={t}
                onMouseEnter={() => {
                  setHoverTrade(t);
                  setHoverEdge(null);
                }}
                onMouseLeave={() => setHoverTrade((cur) => (cur === t ? null : cur))}
              >
                <circle
                  className="fed-node"
                  cx={p.x}
                  cy={p.y}
                  r={NR}
                  fill={fill}
                  stroke={ring}
                  strokeWidth={emphasized ? 2.5 : 1}
                />
                <text
                  x={lx + dx}
                  y={tradeY}
                  textAnchor={anchor}
                  fontSize="11"
                  fill="var(--text)"
                  style={{ textTransform: "capitalize", pointerEvents: "none" }}
                >
                  {cap(t)}
                </text>
                {(isOrigin || isTarget || isHover) && brandName(t) && (
                  <text
                    x={lx + dx}
                    y={brandY}
                    textAnchor={anchor}
                    fontSize="9"
                    fill="var(--muted)"
                    style={{ pointerEvents: "none" }}
                  >
                    {brandName(t)}
                  </text>
                )}
              </g>
            );
          })}

          {/* ---- geography scatter (brand-AND-geography) ---- */}
          {showGeo && (
            <g aria-label="Geography scatter">
              <rect
                x={GEO.x}
                y={GEO.y}
                width={GEO.w}
                height={GEO.h}
                rx={8}
                fill="var(--surface-raised)"
                stroke="var(--border-strong)"
                strokeWidth={1}
                opacity={0.55}
              />
              <text x={GEO.x + 10} y={GEO.y + 15} fontSize="9.5" fill="var(--faint)">
                geography · proximity
              </text>

              {/* proximity rings around the job location (a faint distance hint) */}
              {jobLoc &&
                [26, 46].map((rr) => (
                  <circle
                    key={`ring${rr}`}
                    cx={jobX}
                    cy={jobY}
                    r={rr}
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    opacity={0.4}
                  />
                ))}

              {/* thin lines job → each partner so proximity is legible */}
              {jobLoc &&
                geoPts.map((p) => {
                  const won = p.id === consensusId;
                  const disputed =
                    !!split && (p.id === split.partnerAId || p.id === split.partnerBId);
                  return (
                    <line
                      key={`gl${p.id}`}
                      x1={jobX}
                      y1={jobY}
                      x2={projLng(p.lng)}
                      y2={projLat(p.lat)}
                      stroke={
                        won ? "var(--teal)" : disputed ? "var(--amber)" : "var(--border-strong)"
                      }
                      strokeWidth={won ? 1.5 : 1}
                      opacity={won ? 0.7 : 0.32}
                    />
                  );
                })}

              {/* partner dots */}
              {geoPts.map((p) => {
                const won = p.id === consensusId;
                const disputed =
                  !!split && (p.id === split.partnerAId || p.id === split.partnerBId);
                const fill = won
                  ? "var(--teal)"
                  : disputed
                    ? "var(--amber)"
                    : "var(--muted)";
                return (
                  <circle key={`gp${p.id}`} cx={projLng(p.lng)} cy={projLat(p.lat)} r={won ? 4.5 : 3.2} fill={fill}>
                    <title>{p.name}</title>
                  </circle>
                );
              })}

              {/* job-location marker: a crosshair ring (⌖) */}
              {jobLoc && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={jobX} cy={jobY} r={6} fill="none" stroke="var(--text)" strokeWidth={1.5} />
                  <line x1={jobX - 9} y1={jobY} x2={jobX + 9} y2={jobY} stroke="var(--text)" strokeWidth={1} />
                  <line x1={jobX} y1={jobY - 9} x2={jobX} y2={jobY + 9} stroke="var(--text)" strokeWidth={1} />
                  <text
                    x={jobX}
                    y={jobY + 20}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="var(--muted)"
                  >
                    {jobLoc.label}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ---- richer retrieved-partner cards ---- */}
          {tp &&
            partners.map((c, i) => {
              const won = c.partner.id === consensusId;
              const disputed =
                !!split && (c.partner.id === split.partnerAId || c.partner.id === split.partnerBId);
              const ring = won ? "var(--teal)" : disputed ? "var(--amber)" : "var(--border-strong)";
              const inNet = c.partner.brandId != null;
              const capStatus = c.partner.capacityStatus;
              const capLabel =
                capStatus === "open_today"
                  ? "open today"
                  : capStatus === "this_week"
                    ? "this week"
                    : "backlogged";
              const capColor =
                capStatus === "open_today"
                  ? "var(--teal)"
                  : capStatus === "backlogged"
                    ? "var(--amber)"
                    : "var(--muted)";
              const top = pY(i) - 26;
              const bars: { label: string; v: number }[] = [
                { label: "fit", v: c.subScores.fit },
                { label: "cap", v: c.subScores.capacity },
                { label: "prox", v: c.subScores.proximity },
              ];
              const badgeW = inNet ? 62 : 40;
              return (
                <g key={c.partner.id}>
                  <rect
                    className="fed-card"
                    x={PX}
                    y={top}
                    width={PW}
                    height={52}
                    rx={7}
                    fill="var(--surface-raised)"
                    stroke={ring}
                    strokeWidth={won || disputed ? 2 : 1}
                  />
                  {/* name */}
                  <text x={PX + 12} y={top + 17} fontSize="11.5" fill="var(--text)">
                    {c.partner.name}
                  </text>

                  {/* in-network / local badge (top-right) */}
                  <rect
                    x={PX + PW - badgeW - 10}
                    y={top + 7}
                    width={badgeW}
                    height={14}
                    rx={7}
                    fill={inNet ? "var(--teal-dim)" : "var(--surface-raised)"}
                    stroke={inNet ? "var(--teal)" : "var(--border-strong)"}
                    strokeWidth={1}
                  />
                  <text
                    x={PX + PW - badgeW / 2 - 10}
                    y={top + 17}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill={inNet ? "var(--teal)" : "var(--muted)"}
                  >
                    {inNet ? "in-network" : "local"}
                  </text>

                  {/* capacity chip */}
                  <rect
                    x={PX + 12}
                    y={top + 24}
                    width={64}
                    height={13}
                    rx={6.5}
                    fill="var(--surface-raised)"
                    stroke={capColor}
                    strokeWidth={1}
                    opacity={0.9}
                  />
                  <text
                    x={PX + 12 + 32}
                    y={top + 33.5}
                    textAnchor="middle"
                    fontSize="8"
                    fill={capColor}
                  >
                    {capLabel}
                  </text>

                  {/* sub-score mini-bars: fit (hybrid) / capacity / proximity */}
                  {bars.map((bar, bi) => {
                    const bx = PX + 90 + bi * 70;
                    const trackW = 44;
                    const isFit = bar.label === "fit";
                    return (
                      <g key={bar.label}>
                        <text x={bx} y={top + 27} fontSize="7.5" fill="var(--muted)">
                          {isFit ? "hybrid fit" : bar.label}
                        </text>
                        <rect
                          x={bx}
                          y={top + 31}
                          width={trackW}
                          height={4}
                          rx={2}
                          fill="var(--border-strong)"
                          opacity={0.6}
                        />
                        <rect
                          x={bx}
                          y={top + 31}
                          width={Math.max(1.5, trackW * clamp01(bar.v))}
                          height={4}
                          rx={2}
                          fill={won ? "var(--teal)" : "var(--muted)"}
                        >
                          <title>
                            {isFit ? "hybrid fit (BM25 + vector)" : bar.label} {bar.v.toFixed(2)}
                          </title>
                        </rect>
                      </g>
                    );
                  })}
                </g>
              );
            })}

          {/* ---- captions ---- */}
          {tp && partners.length > 0 && (
            <text x={PX + PW / 2} y={24} textAnchor="middle" fontSize="10" fill="var(--faint)">
              local partner graph (retrieved)
            </text>
          )}

          {/* hover / route caption spanning the width */}
          <text x={16} y={494} fontSize="10.5" style={{ pointerEvents: "none" }}>
            {caption ?? partnerCaptionRow("hover an edge or a trade to inspect the cross-trade signal")}
          </text>
        </svg>

        {!state.job && (
          <p style={{ margin: "4px 2px 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
            The engine queries a <b style={{ color: "var(--text)" }}>federated graph</b> — Neighborly&rsquo;s
            brand-capability subgraph (the trades above, linked by <b style={{ color: "var(--text)" }}>weighted,
            directed</b> cross-trade adjacency edges) merged with a live local-partner graph. Hover an edge to read why
            two trades connect, or hover a trade to see what it routes to. Route an opportunity and the path lights up:
            origin trade → adjacency edge → target trade → the partners pulled for it, placed on a{" "}
            <b style={{ color: "var(--text)" }}>geography scatter</b> so proximity becomes something you can see.
          </p>
        )}
      </div>
    </section>
  );
}
