import { describe, expect, it } from "bun:test";
import { beginCostCapture, costOf, endCostCapture, formatUsd, priceOf, recordUsage } from "@/lib/cost";

describe("LLM cost monitor", () => {
  it("prices a call from its token usage", () => {
    // gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output
    const usd = costOf({ model: "openai/gpt-4o-mini", promptTokens: 1000, completionTokens: 500 });
    expect(usd).toBeCloseTo((1000 * 0.15 + 500 * 0.6) / 1_000_000, 12);
  });

  it("falls back to a default price for an unlisted model", () => {
    expect(priceOf("some/unknown-model")).toEqual(priceOf("another/unknown-model"));
    expect(costOf({ model: "unknown", promptTokens: 1_000_000, completionTokens: 0 })).toBeGreaterThan(0);
  });

  it("accumulates a run's usage into a summary", () => {
    beginCostCapture();
    recordUsage({ model: "openai/gpt-4o-mini", promptTokens: 1000, completionTokens: 200 });
    recordUsage({ model: "anthropic/claude-sonnet-4.6", promptTokens: 1000, completionTokens: 300 });
    const s = endCostCapture();
    expect(s.calls).toBe(2);
    expect(s.promptTokens).toBe(2000);
    expect(s.completionTokens).toBe(500);
    expect(s.usd).toBeGreaterThan(0);
    expect(Object.keys(s.byModel)).toHaveLength(2);
  });

  it("reports $0 with no captured calls (deterministic mode)", () => {
    beginCostCapture();
    const s = endCostCapture();
    expect(s.usd).toBe(0);
    expect(s.calls).toBe(0);
    expect(formatUsd(0)).toBe("$0.00");
  });
});
