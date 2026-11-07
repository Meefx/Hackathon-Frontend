"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getRuns, startRun } from "@/features/runs/api";
import type { RunArtifact, RunSnapshot, StartRunRequest } from "@/features/runs/types";
import { errorMessage } from "@/lib/http";
import styles from "./manager-chat.module.css";

export function TaskProposalCard({ artifact, run }: { artifact: RunArtifact; run: RunSnapshot }) {
  const [childId, setChildId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  const proposal = artifact.proposal;
  const mode = run.actual_runtime_mode || run.requested_runtime_mode;
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (proposal) void getRuns(proposal.account_id, 0, controller.signal, artifact.id)
      .then(result => {
        if (!controller.signal.aborted) setChildId(result.items[0]?.id || null);
      }).catch(() => { /* The explicit action retries this read before any write. */ });
    return () => { mounted.current = false; controller.abort(); };
  }, [artifact.id, proposal]);
  if (!proposal) return null;
  async function accept() {
    if (!proposal || locked.current || childId || (mode !== "simulated" && mode !== "hermes")) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const body: StartRunRequest = {
      instruction: proposal.instruction, task_type: proposal.task_type,
      runtime_mode: mode, manager_session_id: null, idempotency_key: artifact.id,
    };
    try {
      const prior = await getRuns(proposal.account_id, 0, undefined, artifact.id);
      const id = prior.items[0]?.id || (await startRun(proposal.account_id, body)).run_id;
      if (mounted.current) setChildId(id);
    } catch (reason) {
      if (mounted.current) setError(`${errorMessage(reason)} Rechecking this action uses the same request key and task payload.`);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const label = proposal.task_type === "follow_up" ? "Prepare follow-up draft"
    : proposal.task_type === "collector_brief" ? "Prepare collector brief" : "Prepare improvement proposal";
  return <section className={styles.proposal} aria-label="Suggested account task">
    <strong>{label}</strong>
    <p>{artifact.text}</p>
    <p>{proposal.instruction}</p>
    <p>Account <Link href={`/accounts/${encodeURIComponent(proposal.account_id)}`}>{proposal.account_id}</Link> · {mode} runtime</p>
    <p>Suggested action awaiting your choice. Review the resulting draft and use the account dispatch controls to send it.</p>
    {childId ? <Link href={`/runs/${encodeURIComponent(childId)}`}>Open prepared task</Link>
      : <button className="button" disabled={busy || (mode !== "simulated" && mode !== "hermes")} onClick={() => void accept()}>{busy ? "Checking task request…" : label}</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
