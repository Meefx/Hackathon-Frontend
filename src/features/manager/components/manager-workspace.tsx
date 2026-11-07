"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { useRemote } from "@/hooks/use-remote";
import { getAccounts } from "@/features/accounts/api";
import { getIntegrations } from "@/features/integrations/api";
import { getAgents } from "@/features/agents/api";
import { getRuns, startRun } from "@/features/runs/api";
import type { StartRunRequest, TaskType } from "@/features/runs/types";
import { errorMessage } from "@/lib/http";
import { readJournal, writeJournal, clearJournal } from "../recovery-journal";
import type { RecoveryJournal } from "../types";
import { SessionHistory } from "./session-history";
import styles from "@/components/ui/panels.module.css";
export function ManagerWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [account, setAccount] = useState(params.get("account") || "");
  const [session, setSession] = useState<string | null>(params.get("session"));
  const [instruction, setInstruction] = useState("");
  const [task, setTask] = useState<TaskType>("follow_up");
  const [mode, setMode] = useState<"simulated" | "hermes">("simulated");
  const [scenario, setScenario] = useState("reminder");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [journal, setJournal] = useState<RecoveryJournal | null>(null);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const pending = useRef<{ account: string; body: StartRunRequest } | null>(
    null,
  );
  const locked = useRef(false);
  const mounted = useRef(true);
  const recoveryController = useRef<AbortController | null>(null);
  const accounts = useRemote(
    useCallback(
      (signal: AbortSignal) => getAccounts(search, "", offset, signal),
      [search, offset],
    ),
  );
  const agents = useRemote(getAgents);
  const integrations = useRemote(getIntegrations);
  const manager = agents.data?.items.find((item) => item.role === "manager");
  const runtime = integrations.data?.items.find(
    (item) =>
      item.id === (mode === "simulated" ? "simulated_runtime" : "hermes"),
  );
  const modeAllowed = runtime
    ? runtime.implemented &&
      runtime.configured &&
      runtime.health !== "unavailable"
    : !!manager?.available && manager.runtime_mode === mode;
  useEffect(() => {
    mounted.current = true;
    setJournal(readJournal());
    setReady(true);
    return () => {
      mounted.current = false;
      recoveryController.current?.abort();
      locked.current = false;
    };
  }, []);
  async function recover(value: RecoveryJournal) {
    if (locked.current) return;
    locked.current = true;
    recoveryController.current?.abort();
    const controller = new AbortController();
    recoveryController.current = controller;
    setBusy(true);
    setError("");
    try {
      if (value.runId) {
        router.push(`/runs/${encodeURIComponent(value.runId)}`);
        return;
      }
      const result = await getRuns(
        value.accountId,
        0,
        controller.signal,
        value.requestKey,
      );
      if (controller.signal.aborted || !mounted.current) return;
      if (result.items[0]) {
        const next = { ...value, runId: result.items[0].id };
        writeJournal(next);
        setJournal(next);
        router.push(`/runs/${encodeURIComponent(next.runId)}`);
      } else
        setError(
          "No accepted run found yet. Recheck status before starting a fresh task.",
        );
    } catch (reason) {
      if (!controller.signal.aborted && mounted.current)
        setError(errorMessage(reason));
    } finally {
      if (
        recoveryController.current === controller &&
        !controller.signal.aborted &&
        mounted.current
      ) {
        setBusy(false);
        locked.current = false;
      }
    }
  }
  useEffect(() => {
    const value = readJournal();
    if (value) void recover(value);
  }, []); // journal reads never create a task
  async function submit() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const submission = pending.current || {
      account,
      body: {
        instruction: instruction.trim(),
        task_type: task,
        runtime_mode: mode,
        idempotency_key: crypto.randomUUID(),
        manager_session_id: session,
        ...(mode === "simulated"
          ? { demo_scenario: scenario as StartRunRequest["demo_scenario"] }
          : {}),
      },
    };
    pending.current = submission;
    const value = {
      accountId: submission.account,
      requestKey: submission.body.idempotency_key,
      sessionId: submission.body.manager_session_id,
      runId: null,
    };
    setStorageWarning(!writeJournal(value));
    setJournal(value);
    try {
      const accepted = await startRun(submission.account, submission.body);
      const updated = {
        ...value,
        runId: accepted.run_id,
        sessionId: accepted.manager_session_id,
      };
      if (mounted.current || readJournal()?.requestKey === value.requestKey)
        writeJournal(updated);
      if (!mounted.current) return;
      setJournal(updated);
      pending.current = null;
      router.push(`/runs/${encodeURIComponent(accepted.run_id)}`);
    } catch (reason) {
      if (!mounted.current) return;
      setError(
        `${errorMessage(reason)} The request may have been accepted. Recheck the same request or retry its exact payload.`,
      );
    } finally {
      if (mounted.current) setBusy(false);
      locked.current = false;
    }
  }
  return (
    <AppShell title="Manager">
      <div className={styles.header}>
        <div>
          <h1>Collection manager</h1>
          <p>
            Choose an account and ask the manager to coordinate a persisted
            task.
          </p>
        </div>
      </div>
      <div className={styles.stack}>
        {journal && (
          <section className={styles.notice}>
            <strong>Saved task request</strong>
            <p>
              Account {journal.accountId} · Request {journal.requestKey}
            </p>
            <div className={styles.row}>
              <button
                className="button"
                disabled={busy}
                onClick={() => recover(journal)}
              >
                Recheck saved request
              </button>
              {pending.current && (
                <button className="button" disabled={busy} onClick={submit}>
                  Retry same submission
                </button>
              )}
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  clearJournal();
                  setJournal(null);
                  pending.current = null;
                  setError("");
                }}
              >
                Start a fresh request
              </button>
            </div>
          </section>
        )}
        {storageWarning && (
          <p className={styles.notice}>
            Browser storage is unavailable. Keep this page open until the run ID
            is confirmed.
          </p>
        )}
        {error && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}
        <section className={styles.panel}>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              Search all accounts
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOffset(0);
                }}
                maxLength={100}
                placeholder="Borrower or loan reference"
              />
            </label>
            <DataState
              {...accounts}
              retry={accounts.refresh}
              empty={!accounts.data?.items.length}
            >
              <label>
                Select account
                <select
                  value={account}
                  onChange={(event) => {
                    setAccount(event.target.value);
                    setSession(null);
                  }}
                  required
                  disabled={busy || !!journal}
                >
                  <option value="">Choose account</option>
                  {account &&
                    !accounts.data?.items.some(
                      (item) => item.id === account,
                    ) && <option value={account}>{account}</option>}
                  {accounts.data?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.borrower_name} · {item.loan_reference}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.row}>
                <button
                  type="button"
                  className="button"
                  disabled={!offset}
                  onClick={() => setOffset(offset - 10)}
                >
                  Previous accounts
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={
                    !accounts.data || offset + 10 >= accounts.data.total
                  }
                  onClick={() => setOffset(offset + 10)}
                >
                  More accounts
                </button>
                <span className={styles.muted}>
                  {accounts.data?.total} matching accounts
                </span>
              </div>
            </DataState>
            <label>
              Task type
              <select
                value={task}
                onChange={(event) => setTask(event.target.value as TaskType)}
                disabled={busy || !!journal}
              >
                <option value="follow_up">Follow up</option>
                <option value="collector_brief">Collector brief</option>
                <option value="improvement_review">Improvement review</option>
              </select>
            </label>
            <label>
              Runtime mode
              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "simulated" | "hermes")
                }
                disabled={busy || !!journal}
              >
                <option value="simulated">Simulated</option>
                <option value="hermes">Hermes</option>
              </select>
            </label>
            {agents.error && (
              <p role="alert">
                {agents.error}{" "}
                <button
                  type="button"
                  className="button"
                  onClick={agents.refresh}
                >
                  Refresh runtime
                </button>
              </p>
            )}
            <p className={styles.muted}>
              Manager:{" "}
              {manager
                ? `${manager.available ? "available" : "unavailable"} · ${manager.runtime_mode}`
                : "Checking runtime capability…"}
              {manager?.unavailable_reason
                ? ` · ${manager.unavailable_reason}`
                : ""}
            </p>
            {modeAllowed && runtime?.health === "unknown" && (
              <p className={styles.notice}>
                Runtime is configured; live health is unverified. The backend
                will validate availability before execution.
              </p>
            )}
            {!modeAllowed && (
              <p className={styles.notice}>
                The selected runtime is not currently available according to the
                backend.
              </p>
            )}
            {mode === "simulated" && (
              <label>
                Explicit demo scenario
                <select
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value)}
                  disabled={busy || !!journal}
                >
                  <option value="reminder">Reminder</option>
                  <option value="hardship">Hardship</option>
                  <option value="dispute">Dispute</option>
                  <option value="human_request">Human request</option>
                </select>
              </label>
            )}
            <label>
              Instruction
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                minLength={1}
                maxLength={2000}
                required
                disabled={busy || !!journal}
              />
            </label>
            <p className={styles.muted}>
              {session
                ? `Continuing session ${session}`
                : "A new manager session will be created."}{" "}
              Sessions serialize tasks on the backend.
            </p>
            <div>
              <button
                className="button primary"
                type="submit"
                disabled={
                  !ready ||
                  busy ||
                  !!journal ||
                  !account ||
                  !instruction.trim() ||
                  !modeAllowed
                }
              >
                {busy ? "Submitting…" : "Start task"}
              </button>{" "}
              {account && (
                <Link
                  className={styles.link}
                  href={`/accounts/${encodeURIComponent(account)}`}
                >
                  Open account workspace
                </Link>
              )}
            </div>
          </form>
        </section>
        {account && (
          <SessionHistory
            key={account}
            account={account}
            selected={session}
            onSelect={setSession}
          />
        )}
      </div>
    </AppShell>
  );
}
