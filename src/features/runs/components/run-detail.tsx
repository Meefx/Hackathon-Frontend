"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useRunPolling } from "../hooks/use-run-polling";
import { AgentActivityMap } from "./agent-activity-map";
import { cancelRun, recoverRun } from "../api";
import { KnowledgeEvidence, citationAnchor } from "@/features/knowledge";
import { reasonLabel } from "@/features/compliance/reasons";
import { timestamp } from "@/lib/format";
import { ApiError, errorMessage } from "@/lib/http";
import styles from "@/components/ui/panels.module.css";
import { acknowledgeRun, TaskProposalCard } from "@/features/manager";
export function RunDetail({ runId }: { runId: string }) {
  const state = useRunPolling(runId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const pending = useRef<{
    action: string;
    expected_version: number;
    idempotency_key: string;
  } | null>(null);
  const lock = useRef(false);
  async function act(action: string) {
    if (lock.current || !state.run) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    const saved = pending.current || {
      action,
      expected_version: state.run.version,
      idempotency_key: crypto.randomUUID(),
    };
    pending.current = saved;
    try {
      const body = {
        expected_version: saved.expected_version,
        idempotency_key: saved.idempotency_key,
      };
      if (saved.action === "cancel") await cancelRun(runId, body);
      else
        await recoverRun(runId, {
          ...body,
          action: saved.action as "reconcile" | "retry_safe_step",
        });
      pending.current = null;
      state.refresh();
    } catch (reason) {
      setActionError(errorMessage(reason));
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        state.refresh();
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const run = state.run;
  let managerUrl = run ? `/manager?session=${encodeURIComponent(run.manager_session_id)}` : "/manager";
  if (run?.account_id) {
    managerUrl = run.origin === "scheduled"
      ? `/manager?account=${encodeURIComponent(run.account_id)}`
      : `/manager/tasks?account=${encodeURIComponent(run.account_id)}&session=${encodeURIComponent(run.manager_session_id)}`;
  }
  useEffect(() => {
    if (run?.account_id) acknowledgeRun(run.id, run.account_id);
  }, [run]);
  return (
    <AppShell title="Run detail">
      <div className={styles.header}>
        <div>
          <h1>Run progress</h1>
          <p className={styles.code}>{runId}</p>
        </div>
        <button className="button" onClick={state.refresh}>
          Refresh run
        </button>
      </div>
      {state.error && (
        <p className={styles.notice} role="alert">
          {state.delayed
            ? "Status update delayed. Last confirmed state remains below. "
            : ""}
          {state.error}
        </p>
      )}
      {!run && !state.error && <p role="status">Loading run…</p>}
      {run && (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.row}>
              <strong className={styles.badge}>{run.status}</strong>
              <span className={styles.badge}>{run.phase}</span>
              {run.outcome && (
                <span className={styles.badge}>{run.outcome}</span>
              )}
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>Requested runtime</dt>
                <dd>{run.requested_runtime_mode}</dd>
              </div>
              <div>
                <dt>Actual runtime</dt>
                <dd>{run.actual_runtime_mode || "Not started"}</dd>
              </div>
              <div>
                <dt>Version / turn</dt>
                <dd>
                  {run.version} / {run.session_turn_index}
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{timestamp(run.created_at)}</dd>
              </div>
              <div>
                <dt>Heartbeat</dt>
                <dd>{timestamp(run.heartbeat_at)}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{timestamp(run.finished_at)}</dd>
              </div>
            </dl>
            {run.cancellation_requested_at && run.status !== "cancelled" && (
              <p className={styles.notice}>
                Stop requested at {timestamp(run.cancellation_requested_at)}.
                Worker cancellation is not confirmed.
              </p>
            )}
            {run.reason_codes.map((code) => (
              <p className={styles.notice} key={code}>
                {reasonLabel(code)}{" "}
                <span className={styles.code}>({code})</span>
              </p>
            ))}
            <div className={styles.row}>
              {run.account_id && <Link
                className={styles.link}
                href={`/accounts/${encodeURIComponent(run.account_id)}`}
              >
                Open account
              </Link>}
              <Link
                className={styles.link}
                href={managerUrl}
              >
                Continue with manager
              </Link>
              {run.allowed_actions
                .filter((action) =>
                  ["cancel", "reconcile", "retry_safe_step"].includes(action),
                )
                .map((action) => (
                  <button
                    className="button"
                    key={action}
                    disabled={
                      busy ||
                      (!!pending.current && pending.current.action !== action)
                    }
                    onClick={() => act(action)}
                  >
                    {action === "cancel"
                      ? "Request cancellation"
                      : action === "reconcile"
                        ? "Reconcile run"
                        : "Retry safe step"}
                  </button>
                ))}
            </div>
            {actionError && (
              <p className={styles.notice} role="alert">
                {actionError}
              </p>
            )}
            {pending.current && !busy && (
              <button
                className="button"
                onClick={() => act(pending.current!.action)}
              >
                Retry same action
              </button>
            )}
          </section>
          <AgentActivityMap key={run.id} run={run} activity={state.activity} onRefresh={state.refresh} />
          <section className={styles.panel}>
            <h2>Specialist steps</h2>
            {!run.steps.length && <p>No steps reported yet.</p>}
            <ol className={styles.list}>
              {[...run.steps]
                .sort((a, b) => a.sequence - b.sequence)
                .map((step) => (
                  <li className={styles.item} key={step.id}>
                    <div className={styles.row}>
                      <strong>
                        {step.sequence}. {step.role}
                      </strong>
                      <span className={styles.badge}>{step.status}</span>
                      <span className={styles.badge}>
                        {step.evidence_origin}
                      </span>
                    </div>
                    <p>{step.summary}</p>
                    <p className={styles.muted}>
                      {timestamp(step.started_at)} –{" "}
                      {timestamp(step.finished_at)}
                    </p>
                  </li>
                ))}
            </ol>
          </section>
          <section className={styles.panel}>
            <h2>Run artifacts</h2>
            {!run.artifacts.length && <p>No artifacts recorded.</p>}
            <ul className={styles.list}>
              {run.artifacts.map((artifact) => (
                <li className={styles.item} key={artifact.id}>
                  <h3>{artifact.kind.replaceAll("_", " ")}</h3>
                  {artifact.kind === "qa_report" && (
                    <p className={styles.muted}>
                      Advisory QA evidence. Dispatch authorization is evaluated
                      by the backend.
                    </p>
                  )}
                  {artifact.review_state && (
                    <p className={styles.badge}>
                      Review: {artifact.review_state}
                    </p>
                  )}
                  {artifact.kind === "improvement_proposal" && (
                    <p className={styles.muted}>
                      Proposal only. Publishing a policy or SOP change requires
                      the knowledge workflow.
                    </p>
                  )}
                  {artifact.kind === "manager_task_proposal"
                    ? <TaskProposalCard artifact={artifact} run={run} />
                    : <p className={styles.text}>{artifact.text}</p>}
                  <div className={styles.row}>
                    {artifact.citation_ids.map((id) => (
                      <a
                        className={styles.link}
                        key={id}
                        href={`#${citationAnchor(runId, id)}`}
                      >
                        {id}
                      </a>
                    ))}
                    {artifact.message_id && run.account_id && (
                      <Link
                        className={styles.link}
                        href={`/accounts/${encodeURIComponent(run.account_id)}#message-${encodeURIComponent(artifact.message_id)}`}
                      >
                        Open draft in account
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <KnowledgeEvidence
            key={runId}
            runId={runId}
            runVersion={run.version}
            citationIds={Array.from(
              new Set(run.artifacts.flatMap((item) => item.citation_ids)),
            )}
          />
          <section className={styles.panel}>
            <h2>Event timeline</h2>
            <ol className={styles.list}>
              {state.events.map((event) => (
                <li className={styles.item} key={event.sequence}>
                  <strong>
                    {event.sequence}. {event.type}
                  </strong>
                  <p>{event.safe_summary}</p>
                  <p className={styles.muted}>
                    {event.evidence_origin} · {timestamp(event.created_at)}
                  </p>
                </li>
              ))}
            </ol>
            {!state.events.length && <p>No events recorded.</p>}
          </section>
        </div>
      )}
    </AppShell>
  );
}
