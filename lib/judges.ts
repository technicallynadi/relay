// Effective jury roster: the built-in judge personas (data/judges.ts) with per-judge model
// overrides read from relay.config.yaml, so an operator can swap any judge's model by editing
// the file (picked up on reload). The provider label and model name shown in the jury are
// derived from the model slug, so an override changes both the routing and the display.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { JUDGES } from "@/data/judges";
import type { Judge } from "@/lib/types";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  meta: "Meta",
  "meta-llama": "Meta",
  google: "Google",
  mistralai: "Mistral",
  "x-ai": "xAI",
  deepseek: "DeepSeek",
  cohere: "Cohere",
};

// "anthropic/claude-haiku-4.5" -> "Anthropic"
export function providerOf(slug: string): string {
  const fam = slug.includes("/") ? slug.slice(0, slug.indexOf("/")) : "";
  return PROVIDER_LABEL[fam] ?? (fam ? fam[0].toUpperCase() + fam.slice(1) : "Custom");
}

// "anthropic/claude-haiku-4.5" -> "claude-haiku-4.5"
export function modelNameOf(slug: string): string {
  return slug.includes("/") ? slug.slice(slug.indexOf("/") + 1) : slug;
}

export function effectiveJudges(): Judge[] {
  const overrides: Record<string, string> = {};
  try {
    const raw = readFileSync(join(process.cwd(), "relay.config.yaml"), "utf8");
    const data = parse(raw) as { judges?: Record<string, unknown> };
    for (const [id, model] of Object.entries(data?.judges ?? {})) {
      if (typeof model === "string" && model.trim()) overrides[id] = model.trim();
    }
  } catch {
    // no config / unreadable → the built-in defaults below
  }
  return JUDGES.map((j) => {
    const model = overrides[j.id] ?? j.model;
    return { ...j, model, modelFamily: providerOf(model) };
  });
}

// A compact shape for the UI (jury cards show model + provider).
export interface JudgeInfo {
  id: string;
  name: string;
  model: string; // e.g. "gpt-4o-mini"
  provider: string; // e.g. "OpenAI"
}

export function judgeInfo(): JudgeInfo[] {
  return effectiveJudges().map((j) => ({
    id: j.id,
    name: j.name,
    model: modelNameOf(j.model),
    provider: providerOf(j.model),
  }));
}
