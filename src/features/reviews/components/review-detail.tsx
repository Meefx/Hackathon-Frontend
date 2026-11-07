"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ReviewDiscussion } from "@/features/manager";
import { getReview, resolveReview } from "../api";
import type { ReviewResolution, ReviewResolutionResult } from "../types";
import { getPolicy } from "@/features/compliance/api";
import { CaseControls } from "@/features/compliance";
import { AuditTimeline } from "@/features/audit";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { ApiError, errorMessage } from "@/lib/http";
import { timestamp } from "@/lib/format";
import { reasonLabel } from "@/features/compliance/reasons";
import styles from "@/components/ui/panels.module.css";
import type { CaseActionResult } from "@/features/compliance/types";
export function ReviewDetail({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const state = useRemote(
    useCallback((signal: AbortSignal) => getReview(id, signal), [id]),
  );
  const [revision, setRevision] = useState(0);
  const [caseResult, setCaseResult] = useState<CaseActionResult | null>(null);
  const [decision, setDecision] =
    useState<ReviewResolution["decision"]>("keep_paused");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    (ReviewResolutionResult & { decision: ReviewResolution["decision"] }) | null
  >(null);
  const pending = useRef<ReviewResolution | null>(null);
  const locked = useRef(false);
  const account = state.data?.account_id;
  const policy = useRemote(
    useCallback(
      (signal: AbortSignal) => {
        void revision;
        return account ? getPolicy(account, signal) : Promise.resolve(null);
      },
      [account, revision],
    ),
  );
  function refresh() {
    state.refresh();
    setRevision((value) => value + 1);
    onChanged();
  }
  async function resolve() {
    if (locked.current || !state.data) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const body = pending.current || {
      decision,
      note: note.trim(),
      expected_version: state.data.version,
      idempotency_key: crypto.randomUUID(),
    };
    pending.current = body;
    try {
      const response = await resolveReview(id, body);
      setResult({ ...response, decision: body.decision });
      pending.current = null;
      refresh();
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        refresh();
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <DataState {...state} retry={state.refresh}>
          {state.data && (
            <>
              <h2>Review context</h2>
              <p>
                {state.data.reason} · {state.data.status} · Version{" "}
                {state.data.version}
              </p>
              <p>{timestamp(state.data.created_at)}</p>
              <div className={styles.row}>
                <Link
                  className={styles.link}
                  href={`/accounts/${state.data.account_id}`}
                >
                  Open account
                </Link>
                {state.data.run_id && (
                  <Link
                    className={styles.link}
                    href={`/runs/${state.data.run_id}`}
                  >
                    Open run & knowledge snapshot
                  </Link>
                )}
              </div>
              {state.data.status === "open" && (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void resolve();
                  }}
                >
                  <label>
                    Resolution decision
                    <select
                      value={decision}
                      onChange={(event) =>
                        setDecision(
                          event.target.value as ReviewResolution["decision"],
                        )
                      }
                      disabled={busy || !!pending.current}
                    >
                      <option value="keep_paused">
                        Resolve and keep paused
                      </option>
                      <option value="request_resume">
                        Resolve and request resume
                      </option>
                    </select>
                  </label>
                  <label>
                    Resolution note
                    <textarea
                      required
                      maxLength={1000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      disabled={busy || !!pending.current}
                    />
                  </label>
                  <div>
                    <button
                      className="button primary"
                      disabled={busy || !note.trim() || !!pending.current}
                      type="submit"
                    >
                      Resolve review
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </DataState>
        {pending.current && !busy && (
          <button className="button" onClick={resolve}>
            Retry same resolution
          </button>
        )}
        {error && (
          <p role="alert" className={styles.notice}>
            {error}
          </p>
        )}
        {result && (
          <p role="status" className={styles.notice}>
            Review {result.review.status}. Case {result.case.contact_state};{" "}
            {result.decision === "keep_paused" ? "pause resolution" : "resume"}{" "}
            {result.case.action_applied ? "applied" : "not applied"}.{" "}
            {result.decision === "keep_paused" && "Resume was not requested. "}
            {result.case.reason_codes.map(reasonLabel).join("; ")}
          </p>
        )}
      </section>
      {account && <ReviewDiscussion key={id} reviewId={id} accountId={account} />}
      {caseResult && (
        <p role="status" className={styles.notice}>
          Action {caseResult.action_applied ? "applied" : "not applied"}. Case
          remains {caseResult.contact_state}.{" "}
          {caseResult.reason_codes.map(reasonLabel).join("; ")}
        </p>
      )}
      {account && (
        <>
          <DataState {...policy} retry={policy.refresh}>
            {policy.data && (
              <CaseControls
                onResult={setCaseResult}
                policy={policy.data}
                onChanged={refresh}
              />
            )}
          </DataState>
          <AuditTimeline accountId={account} revision={revision} />
        </>
      )}
    </div>
  );
}
