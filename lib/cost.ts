// LLM cost monitor. Each judge/composer call reports its token usage; we price it through
// a per-model table and accumulate per run. The detector, retriever, feed, and worker make
// no LLM calls, so they cost $0 — cost scales with routes, not feed volume.
//
// Prices are approximate USD list prices per 1M tokens ({ in, out }); edit freely. Unlisted
// models fall back to DEFAULT_PRICE. Accuracy here is "close enough to reason about spend."

export interface Usage {
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface CostSummary {
  usd: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  byModel: Record<string, { usd: number; calls: number }>;
}

const PRICES: Record<string, { in: number; out: number }> = {
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "anthropic/claude-haiku-4.5": { in: 1, out: 5 },
  "meta-llama/llama-3.1-70b-instruct": { in: 0.3, out: 0.4 },
  "meta-llama/llama-3.1-8b-instruct": { in: 0.05, out: 0.08 },
  "anthropic/claude-sonnet-4.6": { in: 3, out: 15 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};
const DEFAULT_PRICE = { in: 0.5, out: 1.5 };

export function priceOf(model: string): { in: number; out: number } {
  return PRICES[model] ?? DEFAULT_PRICE;
}

export function costOf(u: Usage): number {
  const p = priceOf(u.model);
  return (u.promptTokens * p.in + u.completionTokens * p.out) / 1_000_000;
}

// Per-run accumulator. Only one live route runs at a time here (the feed and worker are
// deterministic — no LLM), so a module-level sink is safe. begin → the model adapter
// records each call → end returns the run's summary.
let sink: Usage[] | null = null;

export function beginCostCapture(): void {
  sink = [];
}

export function recordUsage(u: Usage): void {
  sink?.push(u);
}

export function endCostCapture(): CostSummary {
  const items = sink ?? [];
  sink = null;
  const byModel: Record<string, { usd: number; calls: number }> = {};
  let usd = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  for (const u of items) {
    const c = costOf(u);
    usd += c;
    promptTokens += u.promptTokens;
    completionTokens += u.completionTokens;
    (byModel[u.model] ??= { usd: 0, calls: 0 }).usd += c;
    byModel[u.model].calls += 1;
  }
  return { usd, calls: items.length, promptTokens, completionTokens, byModel };
}

// A compact "$0.0140" / "$0.00" formatter for the UI.
export function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
