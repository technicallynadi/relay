"use client";

// The dot-grid glyph motif used across Relay — a small matrix of squares where a
// subset light up in the accent. Deterministic per `pattern` so it doesn't flicker
// between renders. `cols` controls the grid width; `count` the total cells.
interface Props {
  count?: number;
  cols?: number;
  /** Bit pattern: cell i is lit when (pattern >> i) & 1. Defaults to a fixed weave. */
  pattern?: number;
  className?: string;
}

const DEFAULT_PATTERN = 0b10101101; // a steady, legible weave

export function DotGrid({ count = 8, cols = 4, pattern = DEFAULT_PATTERN, className }: Props) {
  return (
    <span className={`dots${cols === 5 ? " w5" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <i key={i} className={(pattern >> i) & 1 ? "on" : undefined} />
      ))}
    </span>
  );
}
