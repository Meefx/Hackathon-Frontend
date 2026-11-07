"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRunPolling } from "@/features/runs";
import { TaskProposalCard } from "./task-proposal-card";
import styles from "./manager-chat.module.css";


export function ChatRunProgress({ id, onFinished }: { id: string; onFinished?: () => void }) {
  const state = useRunPolling(id);
  const notified = useRef(false);
  const run = state.run;
  const terminal = !!run && !["queued", "running"].includes(run.status);
  useEffect(() => {
    if (terminal && onFinished && !notified.current) {
      notified.current = true;
      onFinished();
    }
  }, [terminal, onFinished]);
  return <section className={styles.progress} aria-label="Manager run progress">
    {run ? <>
      <p role="status"><strong>{run.status}</strong> · {run.phase} · {run.actual_runtime_mode || `${run.requested_runtime_mode} requested`}</p>
      {run.actual_runtime_mode === "simulated" && <p className={styles.muted}>Simulated manager response and tool evidence</p>}
      {run.reason_codes.length > 0 && <p>{run.reason_codes.join(" · ")}</p>}
      <details>
        <summary>Inspect run evidence</summary>
        <ol>{run.steps.map(step => <li key={step.id}><strong>{step.role} · {step.status}</strong><p>{step.summary}</p><small>{step.evidence_origin}</small></li>)}</ol>
        <ol>{state.events.map(event => <li key={event.sequence}>{event.safe_summary} · {event.evidence_origin}</li>)}</ol>
        <Link href={`/runs/${encodeURIComponent(id)}`}>Open complete run evidence</Link>
      </details>
      {run.artifacts.filter(artifact => artifact.kind === "manager_task_proposal").map(artifact => <TaskProposalCard key={artifact.id} artifact={artifact} run={run} />)}
    </> : <p role="status">Loading persisted manager run…</p>}
    {state.error && <p role="alert">{state.delayed ? "Status update delayed. " : ""}{state.error} <button className="button" onClick={state.refresh}>Refresh run status</button></p>}
  </section>;
}
