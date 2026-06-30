"use client";

import { useEffect, useState } from "react";

// The themeable accent. Clicking a swatch re-sets --acc (plus its dim/border/ink
// derivatives) on document.documentElement, so every panel re-themes live, and
// persists the choice to localStorage. Mint is the default.
export interface AccentTheme {
  id: string;
  label: string;
  acc: string;
  accD: string; // dim fill behind accent text
  accL: string; // accent border
  accInk: string; // text color on a solid accent button
}

export const ACCENTS: AccentTheme[] = [
  { id: "mint", label: "mint", acc: "#3df0ad", accD: "#0c241b", accL: "#1c6b50", accInk: "#062018" },
  { id: "blue", label: "blue", acc: "#54a8ff", accD: "#0c1c2e", accL: "#1f4a78", accInk: "#04111f" },
  { id: "amber", label: "amber", acc: "#f0b04a", accD: "#2a2210", accL: "#6b5320", accInk: "#231803" },
  { id: "purple", label: "purple", acc: "#c471ed", accD: "#22122c", accL: "#5a3070", accInk: "#1a0922" },
  { id: "pink", label: "pink", acc: "#ff5f8d", accD: "#2e1019", accL: "#7a2a44", accInk: "#2a0612" },
  { id: "white", label: "white", acc: "#ededee", accD: "#1b1b1f", accL: "#45454c", accInk: "#0c0c0e" },
];

const STORAGE_KEY = "relay.accent";

export function applyAccent(theme: AccentTheme) {
  const root = document.documentElement;
  root.style.setProperty("--acc", theme.acc);
  root.style.setProperty("--acc-d", theme.accD);
  root.style.setProperty("--acc-l", theme.accL);
  root.style.setProperty("--acc-ink", theme.accInk);
}

export function AccentPicker() {
  const [activeId, setActiveId] = useState<string>("mint");

  // Restore the persisted choice on mount (default mint).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable — stay on default
    }
    const theme = ACCENTS.find((t) => t.id === stored) ?? ACCENTS[0];
    setActiveId(theme.id);
    applyAccent(theme);
  }, []);

  const choose = (theme: AccentTheme) => {
    setActiveId(theme.id);
    applyAccent(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      // persistence is best-effort
    }
  };

  return (
    <div className="swatches" role="radiogroup" aria-label="Accent color">
      <span className="sw-lab">accent</span>
      {ACCENTS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={activeId === t.id}
          aria-label={t.label}
          title={t.label}
          className={`sw${activeId === t.id ? " on" : ""}`}
          style={{ background: t.acc }}
          onClick={() => choose(t)}
        />
      ))}
    </div>
  );
}
