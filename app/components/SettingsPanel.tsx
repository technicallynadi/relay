"use client";

import { useEffect, useState } from "react";
import { AccentPicker } from "./AccentPicker";

// Settings: live accent theming, the read-only operator profile (sourced from
// relay.config.yaml), and a static note on how to wire up real delivery.

interface Profile {
  name: string;
  initials: string;
  org: string;
  location: string;
}

export function SettingsPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) throw new Error(`profile ${r.status}`);
        return r.json() as Promise<Profile>;
      })
      .then((d) => {
        if (live) setProfile(d);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section aria-label="Settings" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="seclab">
        <b>settings</b>
        <span className="hint">theme · profile · partners · delivery</span>
      </div>

      {/* Accent */}
      <div className="panel">
        <div className="panel-head">
          <h2>Accent</h2>
          <span className="hint">re-themes every panel live</span>
        </div>
        <div className="panel-body">
          <AccentPicker />
        </div>
      </div>

      {/* Profile */}
      <div className="panel">
        <div className="panel-head">
          <h2>Profile</h2>
          <span className="hint">read-only</span>
        </div>
        <div className="panel-body">
          {error ? (
            <div className="error-banner">Couldn&rsquo;t load the profile.</div>
          ) : profile === null ? (
            <div className="idle">
              <span className="idle-title">Loading profile…</span>
            </div>
          ) : (
            <article className="opp">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="av">{profile.initials}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{profile.name}</span>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {profile.org} · {profile.location}
                  </span>
                </div>
              </div>
              <div className="opp-note" style={{ marginTop: 13 }}>
                Edit relay.config.yaml to change this.
              </div>
            </article>
          )}
        </div>
      </div>

      {/* Partner sourcing */}
      <div className="panel">
        <div className="panel-head">
          <h2>Partner sourcing</h2>
          <span className="hint">seeded by default</span>
        </div>
        <div className="panel-body">
          <div className="opp-note" style={{ marginTop: 0 }}>
            Local partners are seeded behind a Google Places adapter seam. Add{" "}
            <span className="mono">GOOGLE_PLACES_API_KEY</span> to <span className="mono">.env</span> to
            pull live local partners/leads near each job instead of the seed.
          </div>
        </div>
      </div>

      {/* Delivery */}
      <div className="panel">
        <div className="panel-head">
          <h2>Delivery</h2>
          <span className="hint">simulated by default</span>
        </div>
        <div className="panel-body">
          <div className="opp-note" style={{ marginTop: 0 }}>
            Send is simulated by default — add <span className="mono">TWILIO_*</span> (SMS) or{" "}
            <span className="mono">RESEND_API_KEY</span> (email) to{" "}
            <span className="mono">.env</span> to deliver the handoff for real.
          </div>
        </div>
      </div>
    </section>
  );
}
