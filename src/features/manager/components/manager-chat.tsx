"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { getAccounts } from "@/features/accounts/api";
import { getAgents } from "@/features/agents/api";
import { getIntegrations } from "@/features/integrations/api";
import { useRemote } from "@/hooks/use-remote";
import { timestamp } from "@/lib/format";
import { ApiError } from "@/lib/http";
import { getChatSession, getChatSessions, getTurns } from "../api";
import { useManagerChat } from "../hooks/use-manager-chat";
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
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [accountOffset, setAccountOffset] = useState(0);
  const [sessionOffset, setSessionOffset] = useState(0);
  const [turnOffset, setTurnOffset] = useState<number | null>(null);
  const [queryResolved, setQueryResolved] = useState(!querySession);
  const { sessionId, runId, contextAccountId, mode } = chat.journal;
  const sessions = useRemote(useCallback((signal: AbortSignal) => {
    void chat.revision;
    return getChatSessions(sessionOffset, signal);
  }, [sessionOffset, chat.revision]));
  const accounts = useRemote(useCallback((signal: AbortSignal) => getAccounts(search, "", accountOffset, signal), [search, accountOffset]));
  const turns = useRemote(useCallback(async (signal: AbortSignal) => {
    void chat.revision;
    if (!sessionId) return { items: [], total: 0, limit: 20, offset: 0 };
    if (turnOffset !== null) return getTurns(sessionId, turnOffset, signal);
    const first = await getTurns(sessionId, 0, signal);
    return first.total > first.limit ? getTurns(sessionId, first.total - first.limit, signal) : first;
  }, [sessionId, turnOffset, chat.revision]));
  const agents = useRemote(getAgents);
  const integrations = useRemote(getIntegrations);
  const manager = agents.data?.items.find(item => item.role === "manager");
  const runtime = integrations.data?.items.find(item => item.id === (mode === "simulated" ? "simulated_runtime" : "hermes"));
  const modeAllowed = runtime
    ? runtime.implemented && runtime.configured && runtime.health !== "unavailable"
    : !!manager?.available && manager.runtime_mode === mode;
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
  async function send(value: string) {
    if (!value.trim() || locked || !modeAllowed) return;
    if (await chat.submit(value)) {
      setQuestion("");
      setTurnOffset(null);
    }
  }
  return <AppShell title="Manager">
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Manager chat sessions">
        <h2>Conversations</h2>
        <button className="button" disabled={chat.busy || chat.active || !!chat.journal.requestKey} onClick={startConversation}>New portfolio chat</button>
        <DataState {...sessions} retry={sessions.refresh} empty={!sessions.data?.items.length}>
          <ul className={styles.sessions}>{sessions.data?.items.map(item => <li key={item.id}>
            <button className={`button ${styles.session}`} aria-pressed={sessionId === item.id} disabled={chat.busy || chat.active || !!chat.journal.requestKey || item.origin === "scheduled" || item.account_id !== null} onClick={() => {
              chat.selectSession(item); setQueryResolved(true); setQuestion(""); setTurnOffset(null);
            }}>{item.title}<small>{timestamp(item.updated_at)}</small></button>
          </li>)}</ul>
          <div className={styles.row}>
            <button className="button" disabled={!sessionOffset} onClick={() => setSessionOffset(value => Math.max(0, value - 20))}>Previous chats</button>
            <button className="button" disabled={!sessions.data || sessionOffset + 20 >= sessions.data.total} onClick={() => setSessionOffset(value => value + 20)}>More chats</button>
          </div>
        </DataState>
        <Link href="/manager/tasks">Advanced account tasks</Link>
        <Link href="/review">Open review queue</Link>
      </aside>
      <section className={styles.conversation} aria-label="Manager conversation">
        <header className={styles.header}>
          <div><h1>Collection manager</h1><p>Ask about the whole portfolio, then drill into an account. The backend Manager Agent coordinates tools and records evidence.</p></div>
        </header>
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
            <Link href={`/accounts/${encodeURIComponent(contextAccountId)}`}>Open account workspace</Link>
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
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send(question); }}>
          <label className={styles.runtime}>Chat runtime<select value={mode} disabled={locked} onChange={event => chat.changeMode(event.target.value as "simulated" | "hermes")}><option value="simulated">Simulated</option><option value="hermes">Hermes</option></select></label>
          <p className={styles.muted}>{mode === "simulated" ? "Simulated demo · synthetic responses and tool evidence" : "Hermes · backend agent runtime with MCP tools"}</p>
          {runtime?.health === "unknown" && modeAllowed && <p role="status">Runtime configured. Live health is unverified and the backend validates execution.</p>}
          {!modeAllowed && <p role="status">Selected chat runtime is unavailable. <button type="button" className="button" onClick={() => { agents.refresh(); integrations.refresh(); }}>Recheck runtime</button></p>}
          {agents.error && <p role="alert">{agents.error}</p>}
          {integrations.error && <p role="alert">{integrations.error}</p>}
          <label>Message the manager<textarea required maxLength={2000} value={question} disabled={locked} onChange={event => setQuestion(event.target.value)} placeholder={contextAccountId ? "Ask about this account…" : "Ask about portfolio priorities, risk, or next steps…"} /></label>
          <div className={styles.row}><button className="button primary" type="submit" disabled={locked || !modeAllowed || !question.trim()}>{chat.busy ? "Submitting…" : chat.active ? "Manager is working…" : "Send message"}</button><small className={styles.muted}>Task suggestions require your explicit action. Dispatch remains in the account workspace.</small></div>
        </form>
      </section>
    </div>
  </AppShell>;

  async function sendRetry() {
    if (await chat.submit(question)) { setQuestion(""); setTurnOffset(null); }
  }
}
