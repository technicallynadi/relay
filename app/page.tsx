"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Decision, Job, RunEvent } from "@/lib/types";
import {
  emptyRun,
  reduceEvent,
  type HumanAction,
  type Outcome,
  type RunState,
} from "./components/runState";
import { type BrandOpt, type RouteTarget, type SeededJob } from "./components/JobConsole";
import {
  OpportunityBoard,
  type BoardOpportunity,
  type BoardStats,
} from "./components/OpportunityBoard";
import { FederationGraph, type AdjEdge } from "./components/FederationGraph";
import { PipelineStrip } from "./components/PipelineStrip";
import { DetectionPanel } from "./components/DetectionPanel";
import { CommitteePanel } from "./components/CommitteePanel";
import { CandidateSheets } from "./components/CandidateSheets";
import { HumanGate, type Delivery } from "./components/HumanGate";
import { AuditLog } from "./components/AuditLog";
import { AppShell } from "./components/AppShell";
import { AccentPicker } from "./components/AccentPicker";
import { KpiRow } from "./components/KpiRow";
import { PartnersPanel } from "./components/PartnersPanel";
import { LocationsPanel } from "./components/LocationsPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { SettingsPanel } from "./components/SettingsPanel";

const EXPECTED_JUDGES = 5;

type RunAction =
  | { kind: "reset"; phase: RunState["phase"] }
  | { kind: "event"; event: RunEvent }
  | { kind: "human"; action: HumanAction; outcome: Outcome | null };

function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.kind) {
    case "reset":
      return emptyRun(action.phase);
    case "event":
      return reduceEvent(state, action.event);
    case "human":
      return { ...state, humanAction: action.action, outcome: action.outcome };
    default:
      return state;
  }
}

// Consume a real NDJSON stream from POST /api/run for a seeded or composed job.
async function* streamFromApi(
  target: RouteTarget,
  minAgreement: number,
  signal: AbortSignal,
): AsyncGenerator<RunEvent> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, minAgreement }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`run endpoint unavailable (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as RunEvent;
    }
  }
  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as RunEvent;
}

export default function Relay() {
  const [state, dispatch] = useReducer(runReducer, undefined, () => emptyRun("idle"));
  const [minAgreement, setMinAgreement] = useState(0.6);

  const [jobs, setJobs] = useState<SeededJob[]>([]);
  const [brands, setBrands] = useState<BrandOpt[]>([]);
  const [adjacency, setAdjacency] = useState<AdjEdge[]>([]);
  // jobId of the card being routed live through the committee (drill-in / send).
  const [routingJobId, setRoutingJobId] = useState<string | null>(null);
  // A brief concierge-style confirmation shown after a send/skip resolves a card.
  const [toast, setToast] = useState<string | null>(null);
  // Live throughput from the feed (cards under the current threshold), drives KpiRow.
  const [boardStats, setBoardStats] = useState<BoardStats>({ detected: 0, auto: 0, escalated: 0 });
  // The delivery seam from POST /api/action — surfaced in the outcome banner.
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  // Set by the board's composer so "+ new scan" can expand + focus it.
  const composeOpenerRef = useRef<(() => void) | null>(null);
  // The opportunity currently routed live — so the gate's action can resolve its card.
  const routedOppRef = useRef<BoardOpportunity | null>(null);
  // The board registers its feed-refetch here so compose/resolve reflect at once.
  const feedRefresherRef = useRef<(() => void) | null>(null);
  // Scroll anchor for the live-engine region, so a starting run pulls itself into view.
  const pipelineRef = useRef<HTMLDivElement>(null);

  // Active workspace view (sidebar nav).
  const [view, setView] = useState("opportunities");
  // Real session metrics for the KPI row: one entry per completed route.
  const [routedRuns, setRoutedRuns] = useState<{ decision: Decision; ms: number }[]>([]);
  // Cumulative LLM spend this session (from each run's cost event; $0 in deterministic mode).
  const [sessionCostUsd, setSessionCostUsd] = useState(0);
  const runStartRef = useRef(0);
  const recordedRunRef = useRef(-1);

  const running = state.phase === "running";
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  // Load the incoming-jobs inbox + brand roster.
  useEffect(() => {
    let alive = true;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setJobs(d.jobs ?? []);
        setBrands(d.brands ?? []);
        setAdjacency(d.adjacency ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Clear the per-card "routing…" label once a run finishes.
  useEffect(() => {
    if (state.phase !== "running") setRoutingJobId(null);
  }, [state.phase]);

  // When a run kicks off, bring the live engine into view so you watch it work.
  useEffect(() => {
    if (state.phase === "running") {
      pipelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.phase]);

  // Auto-dismiss the confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Record each completed route exactly once — feeds the live KPI metrics.
  useEffect(() => {
    if (
      state.phase === "complete" &&
      state.decision != null &&
      recordedRunRef.current !== runIdRef.current
    ) {
      recordedRunRef.current = runIdRef.current;
      const ms = runStartRef.current > 0 ? performance.now() - runStartRef.current : 0;
      const decision = state.decision;
      setRoutedRuns((prev) => [...prev, { decision, ms }]);
      setSessionCostUsd((prev) => prev + (state.cost?.usd ?? 0));
    }
  }, [state.phase, state.decision, state.cost]);

  const execute = useCallback(async (target: RouteTarget, minAgreement: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myRun = ++runIdRef.current;

    runStartRef.current = performance.now();
    setDelivery(null);
    dispatch({ kind: "reset", phase: "running" });

    try {
      for await (const event of streamFromApi(target, minAgreement, controller.signal)) {
        if (controller.signal.aborted || runIdRef.current !== myRun) return;
        dispatch({ kind: "event", event });
      }
    } catch (err) {
      if (controller.signal.aborted || runIdRef.current !== myRun) return;
      dispatch({
        kind: "event",
        event: {
          type: "error",
          message: err instanceof Error ? err.message : "Could not reach the engine for this job.",
        },
      });
    }
  }, []);

  const handleMinAgreement = useCallback((value: number) => setMinAgreement(value), []);

  // Route a decided card live through the committee. Drill-in (review) and an
  // auto-route "send →" both land here — the difference is only what the operator
  // does at the human gate that streams in below the feed.
  const routeBoardOpportunity = useCallback(
    (opp: BoardOpportunity) => {
      setRoutingJobId(opp.jobId);
      routedOppRef.current = opp;
      void execute({ brandId: opp.brandId, techNotes: opp.techNotes, summary: opp.summary }, minAgreement);
    },
    [execute, minAgreement],
  );

  // Composing drops a real card into the live feed (like the worker would), then routes it
  // live so you watch the engine work — the same path every other card follows.
  const composeBoard = useCallback(
    async (brandId: string, techNotes: string) => {
      const brand = brands.find((b) => b.id === brandId);
      if (!brand) return;
      const job: Job = {
        id: `job_compose_${Math.round(performance.now())}`,
        scenarioKey: "composed",
        brandId,
        trade: brand.trade as Job["trade"],
        location: { label: "Plano, TX", lat: 33.0198, lng: -96.6989 },
        summary: "Composed completed job",
        techNotes,
        neededSpecialties: [],
      };
      let opp: BoardOpportunity | null = null;
      try {
        const res = await fetch("/api/incoming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job }),
        });
        if (res.ok) {
          opp = ((await res.json()) as { opportunity?: BoardOpportunity }).opportunity ?? null;
        }
      } catch {
        // fall through — we can still route the composed job live below
      }
      feedRefresherRef.current?.(); // surface the new card at the top of the feed at once
      if (opp) routeBoardOpportunity(opp);
      else {
        routedOppRef.current = null;
        void execute({ brandId, techNotes }, minAgreement);
      }
    },
    [brands, execute, minAgreement, routeBoardOpportunity],
  );

  const handleAction = useCallback(
    async (action: HumanAction): Promise<Outcome | null> => {
      const referralId = state.referralId;
      let outcome: Outcome | null = null;
      let nextDelivery: Delivery | null = null;
      if (referralId) {
        try {
          const res = await fetch("/api/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referralId, action }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              ok: boolean;
              outcome?: Outcome;
              delivery?: Delivery;
            };
            outcome = data.outcome ?? null;
            nextDelivery = data.delivery ?? null;
          }
        } catch {
          // fall through to a local outcome
        }
      }
      if (outcome == null) {
        outcome = action === "send" ? "accepted" : action === "skip" ? "closed" : "accepted";
      }
      setDelivery(nextDelivery);
      // Acting on a card (send or skip) resolves it: it leaves the feed and lives in
      // Activity from here on. Drop it server-side, then refresh so it disappears at once.
      const resolved = routedOppRef.current;
      if (resolved && (action === "send" || action === "skip")) {
        try {
          await fetch(`/api/incoming?jobId=${encodeURIComponent(resolved.jobId)}`, {
            method: "DELETE",
          });
        } catch {
          // best-effort — the next poll still won't include a resolved job
        }
        feedRefresherRef.current?.();
        const partner = resolved.partner ?? "the partner";
        setToast(
          action === "send"
            ? `Held a table with ${partner} — the customer's been notified. Moved to Activity.`
            : "Set aside — logged in Activity.",
        );
      }
      dispatch({ kind: "human", action, outcome });
      return outcome;
    },
    [state.referralId],
  );

  // "+ new scan" / the top-bar compose field expand + focus the board's composer.
  const focusComposer = useCallback(() => {
    composeOpenerRef.current?.();
    document.getElementById("compose-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => document.getElementById("compose-notes")?.focus(), 80);
  }, []);

  const registerComposeOpener = useCallback((open: () => void) => {
    composeOpenerRef.current = open;
  }, []);

  const registerFeedRefresher = useCallback((refresh: () => void) => {
    feedRefresherRef.current = refresh;
  }, []);

  const reachedDetection = state.detection != null;
  const reachedCommitteePhase =
    state.stages.committee !== "queued" || state.candidates.length > 0;

  // avg time-to-route stays measured from the real live runs; the detected /
  // auto / escalated counts come from the live feed under the current threshold.
  const routedDurations = routedRuns.filter((r) => r.decision !== "declined").map((r) => r.ms);
  const avgSeconds = routedDurations.length
    ? routedDurations.reduce((a, b) => a + b, 0) / routedDurations.length / 1000
    : null;

  const subtitle = (
    <>
      cross-trade referral router · a jury of judges gated on <span className="mono">Kendall&rsquo;s W</span>
    </>
  );

  const opportunitiesTopRight = (
    <>
      <button type="button" className="compose-field" onClick={focusComposer}>
        compose a completed job…
        <span className="c" />
      </button>
      <button type="button" className="btn-scan" onClick={focusComposer}>
        + new scan
      </button>
      <RunStatus state={state} />
    </>
  );

  return (
    <AppShell
      title={view.toUpperCase()}
      subtitle={subtitle}
      activeView={view}
      onNavigate={setView}
      topRight={view === "opportunities" ? opportunitiesTopRight : undefined}
    >
      {view === "opportunities" && (
        <>
          <AccentPicker />

          <div className="seclab" style={{ marginTop: 4 }}>
            <b>throughput</b>
            <span className="hint">
              {jobs.length} jobs in queue · {boardStats.detected} arrived this session
            </span>
          </div>
          <KpiRow
            detected={boardStats.detected}
            autoCount={boardStats.auto}
            escalatedCount={boardStats.escalated}
            avgSeconds={avgSeconds}
            costUsd={sessionCostUsd}
          />

          {state.error && (
            <div className="error-banner" role="alert" style={{ marginBottom: 18 }}>
              <span>Run interrupted: {state.error}</span>
            </div>
          )}

          <div className="grid">
            <OpportunityBoard
              brands={brands}
              minAgreement={minAgreement}
              running={running}
              routingJobId={routingJobId}
              onMinAgreement={handleMinAgreement}
              onDrillIn={routeBoardOpportunity}
              onSend={routeBoardOpportunity}
              onCompose={composeBoard}
              onStats={setBoardStats}
              registerComposeOpener={registerComposeOpener}
              registerFeedRefresher={registerFeedRefresher}
            />

            <FederationGraph state={state} brands={brands} adjacency={adjacency} />

            <div
              ref={pipelineRef}
              aria-hidden="true"
              style={{ gridColumn: "1 / -1", height: 0, scrollMarginTop: 80 }}
            />
            {(running || reachedDetection) && <PipelineStrip state={state} />}

            {reachedDetection && <DetectionPanel state={state} />}

            {reachedCommitteePhase && (
              <>
                <CommitteePanel state={state} judgeCount={EXPECTED_JUDGES} />
                <div className="grid grid-main span-2">
                  <CandidateSheets state={state} />
                  <HumanGate state={state} onAction={handleAction} delivery={delivery} />
                </div>
              </>
            )}

            {!reachedCommitteePhase &&
              state.phase === "complete" &&
              state.decision === "declined" && (
                <HumanGate state={state} onAction={handleAction} delivery={delivery} />
              )}

            <AuditLog state={state} />
          </div>
        </>
      )}

      {view === "partners" && <PartnersPanel />}
      {view === "locations" && <LocationsPanel />}
      {view === "activity" && <ActivityPanel />}
      {view === "settings" && <SettingsPanel />}

      {toast && (
        <div className="toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </AppShell>
  );
}

function RunStatus({ state }: { state: RunState }) {
  let dotClass = "dot";
  let label = "Idle";
  if (state.phase === "running") {
    dotClass = "dot live";
    label = "Pipeline running";
  } else if (state.phase === "complete") {
    dotClass = "dot done";
    label = "Run complete";
  } else if (state.phase === "error") {
    dotClass = "dot";
    label = "Run error";
  }
  return (
    <div className="statusline">
      <span>
        <span className={dotClass} />
        {label}
      </span>
      {state.job && (
        <span className="source-chip" title={state.job.summary}>
          {state.job.location.label}
        </span>
      )}
    </div>
  );
}
