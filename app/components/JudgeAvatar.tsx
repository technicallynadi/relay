"use client";

import type { ReactNode } from "react";
import type { JudgePersona } from "./judgePersonas";

// A judge's dot-matrix persona avatar. `thinking` runs a top-to-bottom scan (the judge is
// deliberating); once settled the lit dots hold steady and glow. Pure SVG — crisp at any size.
export function JudgeAvatar({
  persona,
  thinking = false,
  size = 46,
}: {
  persona: JudgePersona;
  thinking?: boolean;
  size?: number;
}) {
  const rows = persona.pattern.length;
  const cols = persona.pattern[0]?.length ?? 0;
  const dots: ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    const row = persona.pattern[y];
    for (let x = 0; x < cols; x++) {
      const key = `${x}-${y}`;
      if (row[x] === "#") {
        dots.push(
          <circle
            key={key}
            className="ja-lit"
            cx={x + 0.5}
            cy={y + 0.5}
            r={0.34}
            style={thinking ? { animationDelay: `${y * 0.07}s` } : undefined}
          />,
        );
      } else {
        dots.push(<circle key={key} className="ja-off" cx={x + 0.5} cy={y + 0.5} r={0.15} />);
      }
    }
  }
  return (
    <svg
      className={`judge-avatar${thinking ? " thinking" : ""}`}
      viewBox={`0 0 ${cols} ${rows}`}
      width={size}
      height={Math.round((size * rows) / cols)}
      role="img"
      aria-label={`${persona.name} — dot-matrix avatar`}
      style={{ ["--ja" as string]: persona.accent }}
    >
      {dots}
    </svg>
  );
}
