"use client";

import Link from "next/link";
import { useRunPolling } from "@/features/runs";
import { reasonLabel } from "@/features/compliance/reasons";
import { DraftReview } from "@/features/conversations";
import styles from "./manager-chat.module.css";

export function PreparedTask({ id }: { id: string }) {
  const state = useRunPolling(id);
  const run = state.run;
  return <section className={styles.prepared} aria-label="Prepared account task">
    {run ? <>
      <p role="status"><strong>{run.status}</strong> · {run.phase.replaceAll("_", " ")}</p>
      {run.actual_runtime_mode === "simulated" && <small className={styles.muted}>Simulated task · synthetic results</small>}
      {run.reason_codes.map(code => <p className={styles.notice} key={code}>{reasonLabel(code)}</p>)}
      {run.artifacts.map(artifact => artifact.kind === "draft" && artifact.message_id && run.account_id
        ? <DraftReview key={artifact.id} accountId={run.account_id} messageId={artifact.message_id} />
        : <div className={styles.taskResult} key={artifact.id}>
        <h3>{artifact.kind.replaceAll("_", " ")}</h3>
        <p className={styles.resultText}>{artifact.text}</p>
      </div>)}
      <details>
        <summary>Specialist progress and evidence</summary>
        <ol>{run.steps.map(step => <li key={step.id}>
          <strong>{step.role} · {step.status}</strong><p>{step.summary}</p><small>{step.evidence_origin}</small>
        </li>)}</ol>
        <ol>{state.events.map(event => <li key={event.sequence}>{event.safe_summary} · {event.evidence_origin}</li>)}</ol>
      </details>
    </> : <p role="status">Loading prepared task…</p>}
    {state.error && <p role="alert">{state.delayed ? "Status update delayed. " : ""}{state.error} <button className="button" onClick={state.refresh}>Refresh task status</button></p>}
    <Link href={`/runs/${encodeURIComponent(id)}`}>Open prepared task</Link>
  </section>;
}
