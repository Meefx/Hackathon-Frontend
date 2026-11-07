"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { getAccounts } from "@/features/accounts/api";
import { useRemote } from "@/hooks/use-remote";
import { timestamp } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { getChatSession, getTurns } from "../api";
import { useManagerChat } from "../hooks/use-manager-chat";
import { useManagerRuntime } from "../hooks/use-manager-runtime";
import type { ManagerSession } from "../types";
import { ChatSidebar } from "./chat-sidebar";
import { ChatRunProgress } from "./chat-run-progress";
import styles from "./manager-chat.module.css";

const prompts = [
  "Summarize the collection portfolio and priorities.",
  "Which accounts need operator attention?",
  "Review portfolio risks and suggest next steps.",
];

export function ManagerChat() {
  const params = useSearchParams();
  const querySession = params.get("session");
  const queryAccount = params.get("account");
  const chat = useManagerChat(queryAccount, !querySession);
  const runtime = useManagerRuntime();
  const thread = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [accountOffset, setAccountOffset] = useState(0);
  const [turnOffset, setTurnOffset] = useState<number | null>(null);
  const [queryResolved, setQueryResolved] = useState(!querySession);
  const { sessionId, runId, contextAccountId } = chat.journal;
  const accounts = useRemote(useCallback((signal: AbortSignal) => getAccounts(search, "", accountOffset, signal), [search, accountOffset]));
  const turns = useRemote(useCallback(async (signal: AbortSignal) => {
    void chat.revision;
    if (!sessionId) return { items: [], total: 0, limit: 20, offset: 0 };
    if (turnOffset !== null) return getTurns(sessionId, turnOffset, signal);
    const first = await getTurns(sessionId, 0, signal);
    return first.total > first.limit ? getTurns(sessionId, first.total - first.limit, signal) : first;
  }, [sessionId, turnOffset, chat.revision]));
  const modeAllowed = runtime.available;
  const selectedAccount = accounts.data?.items.find(item => item.id === contextAccountId);
  const queryLookup = useRemote(useCallback(async (signal: AbortSignal) => {
    if (!querySession) return { session: null, missing: false };
    try {
      return { session: await getChatSession(querySession, signal), missing: false };
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) return { session: null, missing: true };
      throw reason;
    }
  }, [querySession]));
  const queryMatch = queryLookup.data?.session;

  useEffect(() => {
    if (!queryResolved && queryMatch?.account_id === null && queryMatch.origin !== "scheduled" && chat.ready && !chat.busy && !chat.active && !chat.journal.requestKey) {
      chat.selectSession(queryMatch);
      setQueryResolved(true);
    }
  }, [queryResolved, queryMatch, chat.ready, chat.busy, chat.active, chat.journal.requestKey, chat.selectSession]);
  const locked = chat.locked || !queryResolved;

  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [sessionId, runId, turns.data]);

  function startConversation() {
    chat.startNew();
    setQueryResolved(true);
    setQuestion("");
    setTurnOffset(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  function chooseContext(id: string | null) {
    chat.changeContext(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("account", id);
    else url.searchParams.delete("account");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  function chooseSession(session: ManagerSession) {
    chat.selectSession(session);
    setQueryResolved(true);
    setQuestion("");
    setTurnOffset(null);
    const url = new URL(window.location.href);
    url.searchParams.set("session", session.id);
    if (session.context_account_id) url.searchParams.set("account", session.context_account_id);
    else url.searchParams.delete("account");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  async function send(value: string) {
    if (!value.trim() || locked || !modeAllowed) return;
    if (await chat.submit(value, runtime.mode)) {
      setQuestion("");
      setTurnOffset(null);
    }
  }
  return <AppShell title="Manager" variant="chat" sidebar={<ChatSidebar
    sessionId={sessionId} revision={chat.revision}
    locked={!chat.ready || chat.busy || chat.active || !!chat.journal.requestKey}
    onNew={startConversation} onSelect={chooseSession}
  />}>
      <section className={styles.conversation} aria-label="Manager conversation">
        <header className={styles.header}>
          <div><h1>Collection manager</h1><p>Tell me what you need. I’ll coordinate the next steps.</p></div>
        </header>
        <div className={styles.thread} ref={thread}>
        {!queryResolved && queryLookup.loading && <p role="status">Confirming saved portfolio session…</p>}
        {!queryResolved && queryLookup.error && <p role="alert">{queryLookup.error} <button className="button" onClick={queryLookup.refresh}>Retry session lookup</button></p>}
        {!queryResolved && queryLookup.data?.missing && <div className={styles.notice}>
          <p>This session has not been confirmed as a portfolio chat. Account and scheduled histories are available in advanced account tasks.</p>
          <Link href={`/manager/tasks?${new URLSearchParams({ ...(queryAccount ? { account: queryAccount } : {}), ...(querySession ? { session: querySession } : {}) })}`}>Open original account session</Link>
          <p>Choose New portfolio chat to begin a separate conversation.</p>
        </div>}
        <div className={styles.context}>
          <strong>{contextAccountId ? `Account context · ${selectedAccount?.borrower_name || contextAccountId}` : "Whole portfolio"}</strong>
          {contextAccountId && <>
            <button className="button" disabled={locked} onClick={() => chooseContext(null)}>Return to portfolio</button>
          </>}
        </div>
        <details className={styles.search}>
          <summary>Find an account to discuss</summary>
          <label>Search portfolio accounts<input maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setAccountOffset(0); }} placeholder="Borrower or loan reference" /></label>
          <DataState {...accounts} retry={accounts.refresh} empty={!accounts.data?.items.length}>
            <ul className={styles.results}>{accounts.data?.items.map(item => <li key={item.id}><button className="button" disabled={locked} onClick={() => chooseContext(item.id)}>Discuss {item.borrower_name} · {item.loan_reference}</button></li>)}</ul>
            <div className={styles.row}>
              <button className="button" disabled={!accountOffset} onClick={() => setAccountOffset(value => Math.max(0, value - 10))}>Previous accounts</button>
              <button className="button" disabled={!accounts.data || accountOffset + 10 >= accounts.data.total} onClick={() => setAccountOffset(value => value + 10)}>More accounts</button>
              <small>{accounts.data?.total} matching accounts</small>
            </div>
          </DataState>
        </details>
        {sessionId ? <DataState {...turns} retry={turns.refresh}>
          <ol className={styles.transcript} aria-label="Saved manager messages">{turns.data?.items.map(turn => <li className={styles.message} data-role={turn.role} key={turn.id}>
            <strong>{turn.role === "operator" ? "You" : "Manager"}</strong>
            <p>{turn.content}</p>
            <small>{timestamp(turn.created_at)} {turn.run_id && <Link href={`/runs/${encodeURIComponent(turn.run_id)}`}>Inspect evidence</Link>}</small>
            {turn.role === "manager" && turn.run_id && turn.run_id !== runId && <ChatRunProgress id={turn.run_id} />}
          </li>)}</ol>
          {turns.data && turns.data.total > turns.data.limit && <div className={styles.row}>
            <button className="button" disabled={!turns.data.offset} onClick={() => setTurnOffset(Math.max(0, (turns.data?.offset || 0) - 20))}>Earlier messages</button>
            <button className="button" disabled={turns.data.offset + turns.data.limit >= turns.data.total} onClick={() => setTurnOffset((turns.data?.offset || 0) + 20)}>Later messages</button>
          </div>}
        </DataState> : <div className={styles.empty}>
          <h2>What needs your attention today?</h2><p>Start with portfolio priorities or choose an account for a focused discussion.</p>
          <div className={styles.prompts}>{prompts.map(prompt => <button className="button" key={prompt} disabled={locked || !modeAllowed} onClick={() => { setQuestion(prompt); void send(prompt); }}>{prompt}</button>)}</div>
        </div>}
        {runId && <ChatRunProgress key={runId} id={runId} onFinished={chat.finish} />}
        {chat.journal.requestKey && <section className={styles.notice} aria-label="Unconfirmed chat request">
          <p>Saved request {chat.journal.requestKey}. Recovery reads its acceptance status.</p>
          <div className={styles.row}>
            <button className="button" disabled={chat.busy} onClick={() => void chat.recheck()}>Recheck saved chat request</button>
            {chat.hasExactRetry && <button className="button" disabled={chat.busy} onClick={() => void sendRetry()}>Retry same chat request</button>}
            {chat.emptyLookup && <button className="button" disabled={chat.busy} onClick={startConversation}>Start a fresh chat request</button>}
          </div>
          {chat.emptyLookup && <p>A fresh request has a new key. The original request remains unconfirmed.</p>}
        </section>}
        {chat.error && <p className={styles.notice} role="alert">{chat.error}</p>}
        {chat.storageWarning && <p className={styles.notice} role="status">Browser storage is unavailable. Keep this page open to preserve chat recovery.</p>}
        </div>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(question); }}>
          <label>Message the manager<textarea required maxLength={2000} value={question} disabled={locked} onChange={event => setQuestion(event.target.value)} placeholder={contextAccountId ? "Ask about this account…" : "Ask about portfolio priorities, risk, or next steps…"} /></label>
          <div className={styles.composerFooter}>
            <small className={styles.muted}>{runtime.loading ? "Checking manager availability…" : runtime.mode === "simulated" ? "Simulated demo · synthetic responses" : "Hermes · backend agent runtime"}</small>
            <button className="button primary" type="submit" disabled={locked || !modeAllowed || !question.trim()}>{chat.busy ? "Submitting…" : chat.active ? "Manager is working…" : "Send message"}</button>
          </div>
          {!runtime.loading && !modeAllowed && <p role="status">Selected chat runtime is unavailable. <Link href="/settings">Open Settings</Link> <button type="button" className="button" onClick={runtime.refresh}>Recheck runtime</button></p>}
          {runtime.health === "unknown" && modeAllowed && <p role="status">Runtime configured. Live health is unverified and the backend validates execution.</p>}
          {runtime.error && <p role="alert">{runtime.error}</p>}
        </form>
      </section>
  </AppShell>;

  async function sendRetry() {
    if (await chat.submit(question, runtime.mode)) { setQuestion(""); setTurnOffset(null); }
  }
}
