// Delivery seam for the human gate's "Send". When provider keys are present it sends the
// referral handoff for real (Twilio SMS, then Resend email); otherwise it simulates — the
// same adapter-seam pattern as the Google Places stub. Add keys to .env to go live.

import type { DeliveryResult } from "@/lib/types";

export async function deliver(opts: {
  message: string;
  partnerName: string;
  to?: string; // customer phone (SMS) or email; falls back to DEMO_RECIPIENT
}): Promise<DeliveryResult> {
  const to = opts.to || process.env.DEMO_RECIPIENT;

  // --- Twilio SMS ---
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (sid && token && from && to) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: opts.message }),
      });
      return res.ok
        ? { delivered: true, provider: "twilio", channel: "sms", detail: `SMS sent to ${to}` }
        : { delivered: false, provider: "twilio", channel: "sms", detail: `Twilio error ${res.status}` };
    } catch (e) {
      return { delivered: false, provider: "twilio", channel: "sms", detail: `Twilio failed: ${String(e).slice(0, 80)}` };
    }
  }

  // --- Resend email ---
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Relay <onboarding@resend.dev>",
          to,
          subject: "A quick referral from your service pro",
          text: opts.message,
        }),
      });
      return res.ok
        ? { delivered: true, provider: "resend", channel: "email", detail: `Email sent to ${to}` }
        : { delivered: false, provider: "resend", channel: "email", detail: `Resend error ${res.status}` };
    } catch (e) {
      return { delivered: false, provider: "resend", channel: "email", detail: `Resend failed: ${String(e).slice(0, 80)}` };
    }
  }

  // --- Simulated (default) ---
  return {
    delivered: true,
    provider: "simulated",
    channel: "simulated",
    detail: `Simulated — would text/email the customer and notify ${opts.partnerName}. Add TWILIO_* (SMS) or RESEND_API_KEY (email) + DEMO_RECIPIENT to .env to send for real.`,
  };
}
