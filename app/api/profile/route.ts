import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const runtime = "nodejs";

const FALLBACK = {
  name: "unknown",
  initials: "UK",
  org: "neighborly",
  location: "plano",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Reads relay.config.yaml so the operator can edit their own name/org/location.
export function GET() {
  try {
    const raw = readFileSync(join(process.cwd(), "relay.config.yaml"), "utf8");
    const data = parse(raw) as { profile?: Record<string, unknown> };
    const p = data?.profile ?? {};
    const name = String(p.name ?? FALLBACK.name);
    const initials = String(p.initials ?? "").trim() || initialsFrom(name);
    return Response.json({
      name,
      initials: initials.slice(0, 2).toUpperCase(),
      org: String(p.org ?? FALLBACK.org),
      location: String(p.location ?? FALLBACK.location),
    });
  } catch {
    return Response.json(FALLBACK);
  }
}
