"use client";
import { useRef, useState } from "react";
import { caseAction } from "../api";
import type {
  PolicyDecision,
  CaseActionRequest,
  CaseActionResult,
} from "../types";
import { reasonLabel } from "../reasons";
import { ApiError, errorMessage } from "@/lib/http";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
export function CaseControls({
  policy,
  onChanged,
  onResult,
}: {
  policy: PolicyDecision;
  onChanged: () => void;
  onResult?: (result: CaseActionResult) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CaseActionResult | null>(null);
  const pending = useRef<{
    action: "takeover" | "resume";
    body: CaseActionRequest;
  } | null>(null);
  const lock = useRef(false);
  async function act(action: "takeover" | "resume") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const request = pending.current || {
      action,
      body: {
        expected_case_version: policy.case_version,
        idempotency_key: crypto.randomUUID(),
        note: note.trim(),
      },
    };
    pending.current = request;
    try {
      const value = await caseAction(
        policy.account_id,
        request.action,
        request.body,
      );
      setResult(value);
      onResult?.(value);
      pending.current = null;
      setNote("");
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        onChanged();
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel}>
      <h2>Contact policy & human control</h2>
      <div className={styles.row}>
        <span className={styles.badge}>{policy.contact_state}</span>
        <span className={styles.badge}>
          {policy.allowed ? "Contact eligible" : "Contact blocked"}
        </span>
      </div>
      <p className={styles.muted}>
        Policy {policy.policy_version || "missing"} · Case version{" "}
        {policy.case_version} · {timestamp(policy.evaluated_at)}
      </p>
      {policy.reason_codes.map((code) => (
        <p className={styles.notice} key={code}>
          {reasonLabel(code)}
        </p>
      ))}
      <div className={styles.form}>
        <label>
          Case action note
          <textarea
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy || !!pending.current}
          />
        </label>
        <div className={styles.row}>
          <button
            className="button"
            disabled={
              busy ||
              !note.trim() ||
              (!!pending.current && pending.current.action !== "takeover")
            }
            onClick={() => act("takeover")}
          >
            Take over case
          </button>
          <button
            className="button"
            disabled={
              busy ||
              !note.trim() ||
              policy.contact_state === "active" ||
              (!!pending.current && pending.current.action !== "resume")
            }
            onClick={() => act("resume")}
          >
            Request case resume
          </button>
        </div>
        <p className={styles.muted}>
          Takeover requests stop for active work. Run detail shows whether the
          worker has confirmed cancellation. Resume does not send a message.
        </p>
        {pending.current && !busy && (
          <button
            className="button"
            onClick={() => act(pending.current!.action)}
          >
            Retry same case action
          </button>
        )}
        {error && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}
        {result && !onResult && (
          <p className={styles.notice} role="status">
            Action {result.action_applied ? "applied" : "not applied"}. Case
            remains {result.contact_state}.{" "}
            {result.reason_codes.map(reasonLabel).join("; ")}
          </p>
        )}
      </div>
    </section>
  );
}
