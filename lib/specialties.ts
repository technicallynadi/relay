// Deterministic capability-keyword extraction. Pulling these from a free-text tech note
// produces the same "specialty signal" a hand-authored scenario carries — so a job you
// compose on the spot differentiates partners just like the seeded ones, no LLM needed.
// Trade scoping happens downstream (we only compare against partners of the target trade),
// so cross-trade keyword noise is harmless.

export const SPECIALTY_KEYWORDS = [
  // electrical
  "panel", "breaker", "outlet", "wiring", "rewire", "voltage", "load", "surge", "circuit", "ev charger",
  // restoration
  "water", "mold", "flood", "moisture", "drying", "leak", "soot", "smoke", "mitigation", "damage",
  // plumbing
  "drain", "pipe", "sewer", "faucet", "repipe", "supply line", "water heater", "clog",
  // hvac
  "condenser", "furnace", "duct", "thermostat", "refrigerant", "compressor", "coil", "cooling", "heating",
  // dryer vent
  "dryer", "lint", "vent", "exhaust",
  // misc
  "window", "glass", "garage door", "dishwasher", "washer",
];

// Pull the capability keywords present in a free-text note. Longer (multi-word) keys are
// kept ahead of the single words they contain so the strongest signal ranks first.
export function extractSpecialties(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const hits = SPECIALTY_KEYWORDS.filter((k) => t.includes(k));
  return [...new Set(hits)];
}
