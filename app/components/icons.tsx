// Minimal inline SVG icon set — no external icon library. Stroke-based, 1.6px,
// currentColor, sized via the `size` prop. Calm, instrument-panel iconography.

import type { JSX } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function svg(
  path: JSX.Element,
  { size = 16, className }: IconProps,
  viewBox = "0 0 24 24",
): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

// Detector — a radar / scan glyph
export const IconScan = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M11 11 14.5 7.5" />
      <path d="M11 4v2M11 16v2M4 11h2M16 11h2" />
    </>,
    p,
  );

// Retriever — layered graph nodes
export const IconNetwork = (p: IconProps) =>
  svg(
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="7" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <path d="M7.6 7.4 10.6 16M16.6 8.6 13.2 16.4M8 6.4h8" />
    </>,
    p,
  );

// Committee — a balance / scales
export const IconScales = (p: IconProps) =>
  svg(
    <>
      <path d="M12 3v17" />
      <path d="M5 20h14" />
      <path d="M6 7h12" />
      <path d="M6 7 3.5 12.5h5z" />
      <path d="M18 7l-2.5 5.5h5z" />
    </>,
    p,
  );

// Composer — pen / draft
export const IconPen = (p: IconProps) =>
  svg(
    <>
      <path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z" />
      <path d="M14.5 6.5 17.5 9.5" />
    </>,
    p,
  );

// Converged / success — a circled check
export const IconCheck = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2 11 14.6 15.5 9.5" />
    </>,
    p,
  );

// Diverged / escalate — a split / fork
export const IconSplit = (p: IconProps) =>
  svg(
    <>
      <path d="M6 4v6a4 4 0 0 0 4 4h4" />
      <path d="M18 4v6a4 4 0 0 1-4 4" />
      <path d="M4 4h4M16 4h4" />
      <path d="M12 14v6" />
    </>,
    p,
  );

// Alert (escalate to human)
export const IconAlert = (p: IconProps) =>
  svg(
    <>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </>,
    p,
  );

// Person / human gate
export const IconPerson = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </>,
    p,
  );

// Send
export const IconSend = (p: IconProps) =>
  svg(
    <>
      <path d="M21 4 3 11l6 2 2 6 10-15Z" />
      <path d="M9 13l4-4" />
    </>,
    p,
  );

// Chevron
export const IconChevron = (p: IconProps) =>
  svg(<path d="M9 6l6 6-6 6" />, p);

// Play / run
export const IconPlay = (p: IconProps) =>
  svg(<path d="M7 5l11 7-11 7V5Z" />, p);

// Knob / tune (sliders)
export const IconTune = (p: IconProps) =>
  svg(
    <>
      <path d="M4 8h10M18 8h2" />
      <path d="M4 16h2M10 16h10" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
    </>,
    p,
  );

// Star (rating)
export const IconStar = (p: IconProps) =>
  svg(
    <path d="M12 4.5l2.1 4.6 5 .5-3.7 3.4 1 4.9L12 16l-4.4 2.3 1-4.9L4.9 9.6l5-.5z" />,
    p,
  );

// Spark of insight — gem (NOT sparkles; a faceted gem reads as 'considered')
export const IconGem = (p: IconProps) =>
  svg(
    <>
      <path d="M6 4h12l3 5-9 11L3 9z" />
      <path d="M3 9h18M9 4 7.5 9 12 20M15 4l1.5 5L12 20" />
    </>,
    p,
  );

// Document / audit record
export const IconRecord = (p: IconProps) =>
  svg(
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>,
    p,
  );

// Minus circle (declined / no-op)
export const IconNo = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>,
    p,
  );
