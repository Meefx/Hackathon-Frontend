"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAgents } from "@/features/agents/api";
import { getIntegrations } from "@/features/integrations/api";
import { getRuns, startRun } from "@/features/runs/api";
import type { StartRunRequest } from "@/features/runs/types";
import { useRunPolling } from "@/features/runs";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { ApiError, errorMessage } from "@/lib/http";
import { getTurns } from "../api";
import { readDiscussion, writeDiscussion, type DiscussionJournal } from "../review-discussion-journal";
import styles from "@/components/ui/panels.module.css";

function DiscussionProgress({ id, onFinished }: { id: string; onFinished: () => void }) {
  const state = useRunPolling(id);
  const finished = useRef(false);
  const terminal = state.run && !["queued", "running"].includes(state.run.status);
  useEffect(() => {
    if (terminal && !finished.current) {
      finished.current = true;
      onFinished();
    }
  }, [terminal, onFinished]);
  return <div role="status">
    {state.error && <p role="alert">{state.error} <button className="button" onClick={state.refresh}>Refresh discussion status</button></p>}
    {state.run && <p>Discussion {state.run.status} · <Link href={`/runs/${encodeURIComponent(id)}`}>Inspect discussion evidence</Link></p>}
  </div>;
}

export function ReviewDiscussion({ reviewId, accountId }: { reviewId: string; accountId: string }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"simulated" | "hermes">("simulated");
  const [session, setSession] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<DiscussionJournal | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [emptyLookup, setEmptyLookup] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const pending = useRef<StartRunRequest | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const agents = useRemote(getAgents);
  const integrations = useRemote(getIntegrations);
  const turns = useRemote(useCallback(async (signal: AbortSignal) => {
    void revision;
    if (!session) return { items: [], total: 0, limit: 20, offset: 0 };
    const first = await getTurns(session, 0, signal);
    return first.total > first.limit
      ? getTurns(session, first.total - first.limit, signal)
      : first;
  }, [session, revision]));
  const manager = agents.data?.items.find(item => item.role === "manager");
  const runtime = integrations.data?.items.find(item => item.id === (mode === "simulated" ? "simulated_runtime" : "hermes"));
  const modeAllowed = runtime
    ? runtime.implemented && runtime.configured && runtime.health !== "unavailable"
    : !!manager?.available && manager.runtime_mode === mode;
  useEffect(() => {
    mounted.current = true;
    const saved = readDiscussion(accountId, reviewId);
    if (saved) {
      setMode(saved.mode);
      setSession(saved.sessionId);
      setRunId(saved.runId);
      setActive(!!saved.runId);
      if (saved.requestKey) setRecovery(saved);
    }
    setReady(true);
    return () => { mounted.current = false; };
  }, [accountId, reviewId]);

  const recover = useCallback(async (saved: DiscussionJournal, signal?: AbortSignal) => {
    if (!saved.requestKey) return;
    setBusy(true);
    setError("");
    setEmptyLookup(false);
    try {
      const result = await getRuns(accountId, 0, signal, saved.requestKey);
      if (signal?.aborted || !mounted.current) return;
      const accepted = result.items[0];
      if (!accepted) {
        setEmptyLookup(true);
        setError("No accepted discussion found yet. Recheck the saved request before continuing.");
        return;
      }
      const updated = { ...saved, sessionId: accepted.manager_session_id, runId: accepted.id, requestKey: null };
      setStorageWarning(!writeDiscussion(accountId, reviewId, updated));
      setSession(updated.sessionId);
      setRunId(updated.runId);
      setActive(true);
      setRecovery(null);
      pending.current = null;
    } catch (reason) {
      if (!signal?.aborted && mounted.current) setError(errorMessage(reason));
    } finally {
      if (!signal?.aborted && mounted.current) setBusy(false);
    }
  }, [accountId, reviewId]);
  useEffect(() => {
    if (!recovery) return;
    const controller = new AbortController();
    void recover(recovery, controller.signal);
    return () => controller.abort();
  }, [recovery, recover]);
  const onFinished = useCallback(() => {
    setActive(false);
    setRevision(value => value + 1);
  }, []);

  async function submit() {
    if (locked.current || active || recovery || !ready) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const body = pending.current || {
      instruction: question.trim(),
      task_type: "collector_brief" as const,
      review_id: reviewId,
      runtime_mode: mode,
      manager_session_id: session,
      idempotency_key: crypto.randomUUID(),
    };
    pending.current = body;
    setStorageWarning(!writeDiscussion(accountId, reviewId, {
      sessionId: session, runId: null, mode, requestKey: body.idempotency_key,
    }));
    try {
      const accepted = await startRun(accountId, body);
      const saved = { sessionId: accepted.manager_session_id, runId: accepted.run_id, mode: body.runtime_mode, requestKey: null };
      const persisted = writeDiscussion(accountId, reviewId, saved);
      if (!mounted.current) return;
      setStorageWarning(!persisted);
      pending.current = null;
      setSession(accepted.manager_session_id);
      setRunId(accepted.run_id);
      setActive(true);
      setQuestion("");
      setRevision(value => value + 1);
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        setStorageWarning(!writeDiscussion(accountId, reviewId, { sessionId: session, runId, mode, requestKey: null }));
      }
      setError(errorMessage(reason));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function startFresh() {
    pending.current = null;
    setRecovery(null);
    setSession(null);
    setRunId(null);
    setActive(false);
    setQuestion("");
    setError("");
    setEmptyLookup(false);
    setStorageWarning(!writeDiscussion(accountId, reviewId, {
      sessionId: null, runId: null, mode, requestKey: null,
    }));
  }

  const editingLocked = !ready || busy || active || !!pending.current || !!recovery;
  return <section className={styles.panel} aria-label="Case discussion with manager">
    <h2>Discuss with manager</h2>
    <p>Ask about review {reviewId} for account {accountId}. Apply your decision using the review resolution controls.</p>
    {session && <DataState {...turns} retry={turns.refresh}>
      <ol className={styles.list}>{turns.data?.items.map(turn => <li className={styles.item} key={turn.id}>
        <strong>{turn.role}</strong>
        {turn.role === "manager" && mode === "simulated" && <p className={styles.badge}>Simulated manager response</p>}
        <p className={styles.text}>{turn.content}</p>
      </li>)}</ol>
      {turns.data && turns.data.offset > 0 && <p className={styles.muted}>Showing the latest {turns.data.limit} saved discussion turns.</p>}
    </DataState>}
    {runId && <DiscussionProgress key={runId} id={runId} onFinished={onFinished} />}
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label>Discussion runtime
        <select value={mode} disabled={editingLocked || !!session} onChange={event => setMode(event.target.value as typeof mode)}>
          <option value="simulated">Simulated</option>
          <option value="hermes">Hermes</option>
        </select>
      </label>
      {!modeAllowed && <p role="status">Selected discussion runtime is unavailable. <button type="button" className="button" onClick={() => { agents.refresh(); integrations.refresh(); }}>Recheck runtime</button></p>}
      <label>Question for manager
        <textarea required maxLength={2000} value={question} disabled={editingLocked} onChange={event => setQuestion(event.target.value)} />
      </label>
      <button className="button primary" type="submit" disabled={editingLocked || !modeAllowed || !question.trim()}>Ask about case</button>
    </form>
    {storageWarning && <p role="status">Browser storage is unavailable. Keep this page open to preserve discussion recovery.</p>}
    {error && <p role="alert">{error}</p>}
    {recovery && !busy && <button className="button" onClick={() => void recover(recovery)}>Recheck saved discussion request</button>}
    {recovery && emptyLookup && !busy && <div>
      <p>The original request remains unconfirmed. Starting fresh creates a separate discussion.</p>
      <button className="button" onClick={startFresh}>Start a fresh discussion</button>
    </div>}
    {pending.current && !busy && <p>The request may have been accepted. <button className="button" onClick={() => void submit()}>Retry same discussion request</button></p>}
  </section>;
}
