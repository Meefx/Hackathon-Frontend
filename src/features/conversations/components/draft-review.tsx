"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPolicy } from "@/features/compliance/api";
import { reasonLabel } from "@/features/compliance/reasons";
import { getIntegrations } from "@/features/integrations/api";
import { useRemote } from "@/hooks/use-remote";
import { ApiError, errorMessage } from "@/lib/http";
import { dispatchMessage, getMessages } from "../api";
import { readDispatchJournal, writeDispatchJournal, type PendingDispatch } from "../dispatch-journal";
import type { DispatchResult } from "../types";
import styles from "./draft-review.module.css";

export function DraftReview({ accountId, messageId }: { accountId: string; messageId: string }) {
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<DispatchResult | null>(null);
  const pending = useRef<PendingDispatch | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const state = useRemote(useCallback(async (signal: AbortSignal) => {
    const [messages, policy, integrations] = await Promise.all([
      getMessages(accountId, offset, signal), getPolicy(accountId, signal), getIntegrations(signal),
    ]);
    return { messages, policy, integrations };
  }, [accountId, offset]));
  const message = state.data?.messages.items.find(item =>
    item.id === messageId && item.account_id === accountId && item.direction === "outbound",
  );
  const channel = state.data?.integrations.items.find(item => item.id === "simulated_chat");
  const canSend = ready && !state.loading && !state.error && !!state.data?.policy.allowed
    && channel?.implemented && channel.health === "healthy"
    && message?.channel === "simulated_chat" && message.status === "draft" && !outcome;

  useEffect(() => {
    mounted.current = true;
    try {
      pending.current = readDispatchJournal(messageId);
      setHasPending(!!pending.current);
    } catch {
      setStorageWarning(true);
    }
    setReady(true);
    return () => { mounted.current = false; };
  }, [messageId]);

  useEffect(() => {
    if (message && message.status !== "draft" && pending.current && !lock.current) {
      pending.current = null;
      setHasPending(false);
      setStorageWarning(!writeDispatchJournal(messageId, null));
    }
  }, [message, messageId]);

  async function approve() {
    if (lock.current || !canSend || !message) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const body = pending.current || {
      idempotency_key: crypto.randomUUID(), expected_message_version: message.version,
    };
    pending.current = body;
    setHasPending(true);
    setStorageWarning(!writeDispatchJournal(messageId, body));
    try {
      const result = await dispatchMessage(messageId, body, "simulated_chat");
      pending.current = null;
      const persisted = writeDispatchJournal(messageId, null);
      if (mounted.current) {
        setHasPending(false);
        setStorageWarning(!persisted);
        setOutcome(result);
        state.refresh();
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        writeDispatchJournal(messageId, null);
        if (mounted.current) {
          setHasPending(false);
          state.refresh();
        }
      }
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const hasEarlier = !!state.data && state.data.messages.offset + state.data.messages.limit < state.data.messages.total;
  return <section className={styles.review} aria-label="Draft review">
    <h3>Review draft</h3>
    {state.loading && <p role="status">Checking the draft and contact policy…</p>}
    {state.error && <p role="alert">{state.error} <button className="button" onClick={state.refresh}>Retry draft lookup</button></p>}
    {message && <>
      <p className={styles.text}>{message.text}</p>
      <p className={styles.meta}>{message.channel.replaceAll("_", " ")} · version {message.version}</p>
      <p role="status">{outcome
        ? `${outcome.status} · ${outcome.reason_codes.map(reasonLabel).join(" · ") || "Backend dispatch decision confirmed"}`
        : `Message status · ${message.status}`}</p>
      {state.data?.policy.reason_codes.map(code => <p key={code}>{reasonLabel(code)}</p>)}
      {message.channel === "simulated_chat" && message.status === "draft" && !outcome && <>
        <p className={styles.meta}>Your approval requests a simulated send. The backend rechecks contact rules, the recipient, and draft approval.</p>
        <button className="button primary" disabled={!canSend || busy} onClick={() => void approve()}>
          {busy ? "Checking dispatch…" : hasPending ? "Retry same simulated send" : "Approve simulated send"}
        </button>
      </>}
      {message.channel !== "simulated_chat" && <Link href={`/accounts/${encodeURIComponent(accountId)}#message-${encodeURIComponent(messageId)}`}>Open channel-specific draft controls</Link>}
    </>}
    {!state.loading && state.data && !message && <>
      <p>{hasEarlier ? "This draft may be in an earlier message page." : "This draft could not be found in this account’s message history."}</p>
      {hasEarlier && <button className="button" onClick={() => setOffset(state.data!.messages.offset + state.data!.messages.limit)}>Load earlier draft messages</button>}
    </>}
    {hasPending && <p className={styles.meta}>A saved send request is awaiting confirmation. Retrying reuses its original version and request key.</p>}
    {error && <p role="alert">{error}</p>}
    {storageWarning && <p role="status">Browser storage is unavailable. Keep this page open to preserve send recovery.</p>}
  </section>;
}
