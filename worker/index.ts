// Relay ingestion worker. On a cron schedule it pulls a completed-job "signal" off the
// queue (synthesized here) and pushes it to the routing engine (POST /api/incoming),
// which detects the cross-trade opportunity and routes it through the jury. In
// production this is an Inngest/worker cron consuming real "job closed" events from the
// brands' field-service systems.
//
// Run alongside the app:  ./run.sh worker   (or: bun run worker/index.ts)

import { Cron } from "croner";
import { generateJob } from "@/lib/job-generator";

const APP = process.env.RELAY_APP_URL || "http://localhost:3000";
const SCHEDULE = process.env.WORKER_CRON || "*/6 * * * * *"; // every 6 seconds

async function tick() {
  const job = generateJob();
  const stamp = new Date().toISOString().slice(11, 19);
  try {
    const res = await fetch(`${APP}/api/incoming`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      opportunity?: { decision?: string; partner?: string | null; trade?: string | null };
    };
    const o = data.opportunity;
    console.log(
      `[cron ${stamp}] pulled ${job.brandId} (${job.trade}) → ` +
        (o
          ? `${o.trade ?? "—"} · ${o.decision ?? "?"}${o.partner ? ` · ${o.partner}` : ""}`
          : `HTTP ${res.status}`),
    );
  } catch (e) {
    console.log(`[cron ${stamp}] tick failed: ${String(e).slice(0, 80)} — is the app running at ${APP}?`);
  }
}

console.log(`Relay ingestion worker — cron "${SCHEDULE}" → ${APP}/api/incoming`);
new Cron(SCHEDULE, tick);
void tick(); // fire one immediately so you don't wait for the first interval
