import { judgeInfo } from "@/lib/judges";

export const runtime = "nodejs";

// The effective jury roster (built-in defaults + relay.config.yaml overrides). The UI reads
// this to show each judge's model + provider; edit the yaml and reload to change them.
export function GET() {
  return Response.json({ judges: judgeInfo() });
}
