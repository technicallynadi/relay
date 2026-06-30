"use client";

import { useEffect, useState, type ReactNode } from "react";

// Sidebar nav. Relay is a single-page workspace; each item switches the active view.
const PRIMARY_NAV = ["opportunities", "federated network", "partners", "activity"];
const WORKSPACE_NAV = ["locations", "settings"];

interface Profile {
  name: string;
  initials: string;
  org: string;
  location: string;
}
const DEFAULT_PROFILE: Profile = { name: "dana akl", initials: "DA", org: "neighborly", location: "plano" };

interface Props {
  /** Page title in the dot-matrix display face, e.g. "OPPORTUNITIES". */
  title: string;
  /** Sub-line under the title. */
  subtitle: ReactNode;
  /** Right side of the top bar — compose / new-scan actions + run status. */
  topRight?: ReactNode;
  /** The active nav view. */
  activeView: string;
  /** Switch the active view. */
  onNavigate: (view: string) => void;
  children: ReactNode;
}

// The small dot-grid Relay mark — a 3×3 matrix with a fixed lit diagonal weave.
function RelayLogo() {
  const lit = [0, 2, 4, 6, 8];
  return (
    <div className="logo" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <i key={i} className={lit.includes(i) ? "on" : undefined} />
      ))}
    </div>
  );
}

export function AppShell({ title, subtitle, topRight, activeView, onNavigate, children }: Props) {
  // The account card reads from relay.config.yaml (editable by the operator).
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.name) setProfile(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const navButton = (label: string) => (
    <button
      key={label}
      type="button"
      className={`nav${activeView === label ? " on" : ""}`}
      aria-current={activeView === label ? "page" : undefined}
      onClick={() => onNavigate(label)}
    >
      <span className="ic" />
      {label}
    </button>
  );

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <RelayLogo />
          <b>Relay</b>
        </div>

        {PRIMARY_NAV.map(navButton)}

        <div className="navlab">workspace</div>
        {WORKSPACE_NAV.map(navButton)}

        <div className="side-foot">
          <div className="av">{profile.initials}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{profile.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
              {profile.org} · {profile.location}
            </div>
          </div>
        </div>
      </aside>

      <main className="shell">
        <header className="topbar">
          <div className="top-title">
            <h1>{title}</h1>
            <div className="sub">{subtitle}</div>
          </div>
          {topRight && <div className="top-r">{topRight}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
