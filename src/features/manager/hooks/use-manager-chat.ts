"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/http";
import { getChatRequest, startChatRun } from "../api";
import { readChatJournal, writeChatJournal } from "../chat-journal";
import type { ChatJournal, ChatRunRequest, ManagerSession } from "../types";
import type { RunAccepted } from "@/features/runs/types";
import { getRun } from "@/features/runs/api";

export function useManagerChat(initialContext: string | null, restoreSaved: boolean) {
  const [journal, setJournal] = useState<ChatJournal>({
    sessionId: null, runId: null, requestKey: null, mode: "simulated", contextAccountId: initialContext,
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [emptyLookup, setEmptyLookup] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<ChatRunRequest | null>(null);
  const locked = useRef(false);
  const recoveryGeneration = useRef(0);
  const requestedEntryContext = useRef<string | null>(null);
  const mounted = useRef(true);
  const current = useRef(journal);
  const save = useCallback((value: ChatJournal) => {
    current.current = value;
    const persisted = writeChatJournal(value);
    if (mounted.current) {
      setJournal(value);
      setStorageWarning(!persisted);
    }
  }, []);
  const accepted = useCallback((response: RunAccepted, previous: ChatJournal) => {
    save({ ...previous, sessionId: response.manager_session_id, runId: response.run_id, requestKey: null });
    pending.current = null;
    if (mounted.current) {
      setActive(true);
      setRevision(value => value + 1);
      setError("");
      setEmptyLookup(false);
    }
  }, [save]);
  const recover = useCallback(async (value: ChatJournal, signal?: AbortSignal) => {
    if (!value.requestKey || locked.current) return;
    locked.current = true;
    const generation = ++recoveryGeneration.current;
    setBusy(true);
    setError("");
    setEmptyLookup(false);
    try {
      const response = await getChatRequest(value.requestKey, signal);
      if (!signal?.aborted && mounted.current) accepted(response, value);
    } catch (reason) {
      if (!signal?.aborted && mounted.current) {
        setEmptyLookup(reason instanceof ApiError && reason.status === 404);
        setError(reason instanceof ApiError && reason.status === 404
          ? "No accepted chat request found. Recheck the saved request or explicitly start a fresh request."
          : errorMessage(reason));
      }
    } finally {
      if (generation === recoveryGeneration.current) {
        locked.current = false;
        if (!signal?.aborted && mounted.current) setBusy(false);
      }
    }
  }, [accepted]);
  useEffect(() => {
    mounted.current = true;
    const saved = readChatJournal();
    const controller = new AbortController();
    async function restore() {
      let preserveSaved = !!saved && (!!saved.requestKey || (restoreSaved && (!initialContext || saved.contextAccountId === initialContext)));
      if (saved && !preserveSaved && saved.runId) {
        try {
          const previous = await getRun(saved.runId, controller.signal);
          preserveSaved = ["queued", "running"].includes(previous.status);
        } catch {
          // Preserve the saved run until a read can confirm its outcome.
          preserveSaved = true;
        }
      }
      if (controller.signal.aborted) return;
      if (saved && preserveSaved) {
        current.current = saved;
        setJournal(saved);
        setActive(!!saved.runId);
        if (initialContext && saved.contextAccountId !== initialContext) {
          requestedEntryContext.current = initialContext;
          setError("An earlier manager request is still unresolved. Its saved context is preserved while its status is checked.");
        }
        if (saved.requestKey) void recover(saved, controller.signal);
      }
      setReady(true);
    }
    void restore();
    return () => {
      mounted.current = false;
      controller.abort();
      recoveryGeneration.current += 1;
      locked.current = false;
    };
  }, [restoreSaved, recover]);

  async function submit(instruction: string) {
    if (!ready || locked.current || active || (journal.requestKey && !pending.current)) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    const body: ChatRunRequest = pending.current || {
      instruction: instruction.trim(), runtime_mode: journal.mode,
      idempotency_key: crypto.randomUUID(), manager_session_id: journal.sessionId,
      context_account_id: journal.contextAccountId,
    };
    pending.current = body;
    const saved = { ...current.current, requestKey: body.idempotency_key };
    save(saved);
    try {
      const response = await startChatRun(body);
      accepted(response, saved);
      return true;
    } catch (reason) {
      if (mounted.current) setError(`${errorMessage(reason)} The request remains unconfirmed. Recheck before creating another request.`);
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const finish = useCallback(() => {
    setActive(false);
    if (requestedEntryContext.current) {
      save({ ...current.current, sessionId: null, runId: null, requestKey: null,
        contextAccountId: requestedEntryContext.current });
      requestedEntryContext.current = null;
      setError("");
    }
    setRevision(value => value + 1);
  }, [save]);
  function startNew() {
    if (locked.current || active) return;
    pending.current = null;
    save({ ...journal, sessionId: null, runId: null, requestKey: null,
      contextAccountId: requestedEntryContext.current || journal.contextAccountId });
    requestedEntryContext.current = null;
    setError("");
    setEmptyLookup(false);
    setRevision(value => value + 1);
  }
  function selectSession(session: ManagerSession) {
    if (locked.current || active || journal.requestKey || session.id === journal.sessionId) return;
    pending.current = null;
    save({ ...journal, sessionId: session.id, runId: session.last_run_id, requestKey: null,
      contextAccountId: session.context_account_id || null });
    setActive(!!session.last_run_id);
    setError("");
    setRevision(value => value + 1);
  }
  return {
    journal, ready, busy, active, error, storageWarning, emptyLookup, revision,
    locked: !ready || busy || active || !!journal.requestKey,
    hasExactRetry: !!pending.current,
    submit, finish, startNew, selectSession,
    recheck: () => recover(journal),
    changeContext: (id: string | null) => save({ ...journal, contextAccountId: id }),
    changeMode: (mode: ChatJournal["mode"]) => save({ ...journal, mode }),
  };
}
