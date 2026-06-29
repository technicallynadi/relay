// Provider-agnostic model adapter.
// Chat/judges run at runtime (OpenRouter preferred → cross-family panel; OpenAI fallback).
// Embeddings are precomputed at seed time (OpenAI text-embedding-3-small, or a keyless
// deterministic local fallback so the build is never blocked on a key).

import OpenAI from "openai";

export const EMBED_DIM = 1536; // text-embedding-3-small

let chatClient: OpenAI | null = null;
let chatProvider: "openrouter" | "openai" | null = null;

function resolveChatClient(): OpenAI {
  if (chatClient) return chatClient;
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    chatProvider = "openrouter";
    chatClient = new OpenAI({
      apiKey: orKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Referral Opportunity Engine",
      },
    });
    return chatClient;
  }
  const oaKey = process.env.OPENAI_API_KEY;
  if (oaKey) {
    chatProvider = "openai";
    chatClient = new OpenAI({ apiKey: oaKey });
    return chatClient;
  }
  throw new Error(
    "No LLM key set. Add OPENROUTER_API_KEY (recommended) or OPENAI_API_KEY to .env",
  );
}

export function chatProviderName(): string {
  resolveChatClient();
  return chatProvider ?? "unknown";
}

// Resolve a judge/composer's preferred (OpenRouter-style) model id to one the active
// provider accepts. OpenRouter → keep the cross-family slug. OpenAI-direct → map to a
// valid OpenAI model (so judges still run, just without family diversity). No key →
// return the preferred id; the caller's try/catch will fall back to deterministic.
export function resolveModel(preferred: string): string {
  try {
    resolveChatClient();
  } catch {
    return preferred;
  }
  if (chatProvider === "openrouter") return preferred;
  if (preferred.startsWith("openai/")) return preferred.slice("openai/".length);
  return process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";
}

export interface ChatOpts {
  model: string;
  system?: string;
  user: string;
  temperature?: number;
  json?: boolean; // request a JSON object back
}

function buildMessages(opts: ChatOpts) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });
  return messages;
}

export async function chat(opts: ChatOpts): Promise<string> {
  const client = resolveChatClient();
  const res = await client.chat.completions.create({
    model: opts.model,
    messages: buildMessages(opts),
    temperature: opts.temperature ?? 0.2,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function* chatStream(opts: ChatOpts): AsyncGenerator<string> {
  const client = resolveChatClient();
  const stream = await client.chat.completions.create({
    model: opts.model,
    messages: buildMessages(opts),
    temperature: opts.temperature ?? 0.2,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// Parse a JSON object out of a model response, tolerating ```json fences / stray prose.
export function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON object in model output: ${raw.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1)) as T;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const oaKey = process.env.OPENAI_API_KEY;
  if (oaKey) {
    const client = new OpenAI({ apiKey: oaKey });
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return res.data.map((d) => d.embedding as number[]);
  }
  console.warn(
    "[embed] No OPENAI_API_KEY — using deterministic local fallback embeddings " +
      "(coarser semantics). Set the key and re-run `bun run seed` for semantic fit.",
  );
  return texts.map(localEmbed);
}

// Keyless fallback: hashed bag-of-words into a unit vector of EMBED_DIM.
// Real enough for the trade-filtered demo scale; swap for OpenAI by setting the key.
function localEmbed(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
