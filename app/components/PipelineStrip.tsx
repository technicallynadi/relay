"use client";

import { useEffect, useRef, type JSX } from "react";
import { formatUsd } from "@/lib/cost";
import type { PipelineStage } from "@/lib/types";
import {
  PIPELINE_STAGES,
  STAGE_META,
  type RunState,
  type StageStatus,
} from "./runState";
import {
  IconScan,
  IconNetwork,
  IconScales,
  IconPen,
  IconCheck,
} from "./icons";

const STAGE_ICON: Record<PipelineStage, (p: { size?: number }) => JSX.Element> = {
  detector: IconScan,
  retriever: IconNetwork,
  committee: IconScales,
  composer: IconPen,
};

function stateLabel(status: StageStatus): string {
  switch (status) {
    case "live":
      return "live";
    case "done":
      return "done";
    case "skipped":
      return "—";
    default:
      return "queued";
  }
}

// Stages whose reasoning is streamed as prose (retriever shows candidates, not tokens).
const STREAMING_STAGES: PipelineStage[] = ["detector", "committee", "composer"];

interface Props {
  state: RunState;
}

export function PipelineStrip({ state }: Props) {
  // The stage to surface a live stream for: the live one, else the last that has tokens.
  const liveStage = PIPELINE_STAGES.find((s) => state.stages[s] === "live") ?? null;
  const streamStage =
    liveStage && STREAMING_STAGES.includes(liveStage)
      ? liveStage
      : [...STREAMING_STAGES].reverse().find((s) => state.tokens[s]) ?? null;

  return (
    <section className="panel span-2" aria-label="Pipeline">
      <div className="panel-head">
        <h2>Pipeline</h2>
        <span className="hint">
          Detector → Retriever → Jury → Composer
          {state.cost && state.cost.calls > 0 && (
            <>
              {" · "}
              <span className="mono" style={{ color: "var(--acc)" }}>
                {formatUsd(state.cost.usd)}
              </span>
              <span className="mono">
                {" · "}
                {state.cost.calls} calls ·{" "}
                {(state.cost.promptTokens + state.cost.completionTokens).toLocaleString()} tok
              </span>
            </>
          )}
        </span>
      </div>
      <div className="panel-body">
        <div className="pipeline">
          {PIPELINE_STAGES.map((stage, i) => {
            const status = state.stages[stage];
            const Icon = STAGE_ICON[stage];
            const meta = STAGE_META[stage];
            return (
              <div
                key={stage}
                className={`stage ${status}`}
                aria-label={`${meta.label}: ${status}`}
              >
                <div className="stage-head">
                  <span className="stage-idx mono">{i + 1}</span>
                  <span className="stage-name">{meta.label}</span>
                  <span className="stage-icon">
                    {status === "done" ? <IconCheck size={15} /> : <Icon size={15} />}
                  </span>
                </div>
                <span className="stage-state mono">{stateLabel(status)}</span>
                <span className="hint" style={{ fontSize: 11 }}>
                  {meta.blurb}
                </span>
              </div>
            );
          })}
        </div>

        {streamStage && state.tokens[streamStage] && (
          <StreamPanel
            stage={streamStage}
            text={state.tokens[streamStage]}
            live={state.stages[streamStage] === "live"}
          />
        )}
      </div>
    </section>
  );
}

function StreamPanel({
  stage,
  text,
  live,
}: {
  stage: PipelineStage;
  text: string;
  live: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the newest tokens in view as they stream.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div className="stage-stream">
      <div className="stream-label">
        <span
          className="dot"
          style={{
            background: live ? "var(--amber)" : "var(--teal)",
            width: 6,
            height: 6,
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
        {STAGE_META[stage].label} — reasoning
      </div>
      <div className="stream-box mono" ref={boxRef}>
        {text}
        {live && <span className="caret" aria-hidden="true" />}
      </div>
    </div>
  );
}
