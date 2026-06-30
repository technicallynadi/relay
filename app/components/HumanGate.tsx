"use client";

import { useState } from "react";
import type { HumanAction, Outcome, RunState } from "./runState";
import { decisionBadge } from "./runState";
import { IconCheck, IconNo, IconPen, IconPerson, IconSend } from "./icons";

// The delivery seam returned by POST /api/action. All fields optional so the gate
// degrades gracefully if the backend hasn't wired it yet.
export interface Delivery {
  detail?: string;
  channel?: string;
  provider?: string;
}

interface Props {
  state: RunState;
  onAction: (action: HumanAction) => Promise<Outcome | null>;
  delivery?: Delivery | null;
}

export function HumanGate({ state, onAction, delivery }: Props) {
  const [busy, setBusy] = useState<HumanAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const decision = state.decision;
  const reached = state.phase === "complete" && decision != null;
  const original = state.handoff?.customerMessage ?? "";
  const message = draft ?? original;
  const edited = draft != null && draft.trim() !== original.trim();

  // Declined: no gate — a calm "nothing to route" state.
  if (reached && decision === "declined") {
    return (
      <section className="panel" aria-label="Human gate">
        <div className="panel-head">
          <h2>Human gate</h2>
          <span className="hint">Send · Edit · Skip</span>
        </div>
        <div className="panel-body">
          <div className="declined-state">
            <IconNo size={26} />
            <div>
              <div className="ds-title">No referral — nothing to route here</div>
              <div className="ds-sub">
                The detector found no adjacent-trade opportunity, so the pipeline
                stopped. Declining cleanly is the system working as intended.
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const badge = decisionBadge(decision);

  return (
    <section className="panel" aria-label="Human gate">
      <div className="panel-head">
        <h2>Human gate</h2>
        <span className="hint">
          {decision === "escalated" ? "Committee split — you decide" : "Confirm the auto-route"}
        </span>
      </div>
      <div className="panel-body">
        {!reached ? (
          <div className="idle">
            <IconPerson size={22} />
            <span className="idle-title">Awaiting a routable decision</span>
            <span className="idle-sub">
              When the pipeline resolves, you can Send the drafted handoff, Edit it first,
              or Skip the referral. Every choice is written to the audit log.
            </span>
          </div>
        ) : (
          <div className="gate">
            <div className="gate-decision-tag">
              <span className={`badge ${badge.tone}`}>{badge.text}</span>
              {decision === "escalated" && (
                <span style={{ color: "var(--faint)" }}>
                  drafted for the closer partner — adjust before sending
                </span>
              )}
            </div>

            {editing ? (
              <div className="draft-quote">
                <div className="q-label">edit the message, then send</div>
                <textarea
                  value={draft ?? ""}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={5}
                  spellCheck
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="field"
                  style={{
                    resize: "vertical",
                    padding: "10px 12px",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                  }}
                />
              </div>
            ) : (
              message && (
                <div className="draft-quote">
                  <div className="q-label">
                    drafted message to the customer{edited ? " · edited" : ""}
                  </div>
                  {message}
                </div>
              )
            )}

            {state.handoff?.internalNote && !editing && (
              <div className="draft-internal">
                <span className="qi-label">internal referral note</span>
                {state.handoff.internalNote}
              </div>
            )}

            {state.outcome ? (
              <OutcomeBanner
                action={state.humanAction}
                outcome={state.outcome}
                edited={edited}
                delivery={delivery}
              />
            ) : editing ? (
              <div className="gate-actions">
                <GateButton
                  label="Save & send"
                  cls="btn-teal"
                  icon={<IconSend size={14} />}
                  busy={busy === "send"}
                  disabled={busy != null}
                  onClick={async () => {
                    setBusy("send");
                    setEditing(false);
                    await onAction("send");
                    setBusy(null);
                  }}
                />
                <GateButton
                  label="Cancel"
                  cls="btn-ghost"
                  icon={<IconNo size={14} />}
                  busy={false}
                  disabled={busy != null}
                  onClick={() => setEditing(false)}
                />
              </div>
            ) : (
              <div className="gate-actions">
                <GateButton
                  label="Send"
                  cls="btn-teal"
                  icon={<IconSend size={14} />}
                  busy={busy === "send"}
                  disabled={busy != null}
                  onClick={async () => {
                    setBusy("send");
                    await onAction("send");
                    setBusy(null);
                  }}
                />
                <GateButton
                  label="Edit"
                  cls=""
                  icon={<IconPen size={14} />}
                  busy={false}
                  disabled={busy != null}
                  onClick={() => {
                    setDraft(message);
                    setEditing(true);
                  }}
                />
                <GateButton
                  label="Skip"
                  cls="btn-ghost"
                  icon={<IconNo size={14} />}
                  busy={busy === "skip"}
                  disabled={busy != null}
                  onClick={async () => {
                    setBusy("skip");
                    await onAction("skip");
                    setBusy(null);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function GateButton({
  label,
  cls,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  cls: string;
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`btn ${cls}`} onClick={onClick} disabled={disabled}>
      {icon}
      {busy ? "…" : label}
    </button>
  );
}

function OutcomeBanner({
  action,
  outcome,
  edited,
  delivery,
}: {
  action: HumanAction | null;
  outcome: Outcome;
  edited?: boolean;
  delivery?: Delivery | null;
}) {
  const text =
    outcome === "accepted"
      ? action === "send"
        ? `Sent${edited ? " your edited note" : ""} — referral accepted by the partner.`
        : "Referral accepted."
      : outcome === "closed"
        ? "Referral skipped — closed without routing."
        : "Referral declined.";
  // Prefer the backend's delivery detail when present (e.g. "SMS sent to …" or
  // "Simulated — would notify the customer and Rainbow Restoration…").
  const detail = delivery?.detail?.trim() || null;
  return (
    <div className={`gate-outcome ${outcome}`}>
      <IconCheck size={15} />
      <span>
        {text}
        {detail && <span className="go-detail">{detail}</span>}
      </span>
    </div>
  );
}
