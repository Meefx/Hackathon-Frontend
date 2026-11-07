"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceNavigation } from "@/components/layout/workspace-navigation";
import { DataState } from "@/components/ui/data-state";
import { useRemote } from "@/hooks/use-remote";
import { timestamp } from "@/lib/format";
import { getChatSessions } from "../api";
import type { ManagerSession } from "../types";
import styles from "./manager-chat.module.css";

export function ChatSidebar({ sessionId, locked, revision, onNew, onSelect }: {
  sessionId: string | null;
  locked: boolean;
  revision: number;
  onNew: () => void;
  onSelect: (session: ManagerSession) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 781px)");
    const update = () => setHistoryOpen(desktop.matches);
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);
  const sessions = useRemote(useCallback((signal: AbortSignal) => {
    void revision;
    return getChatSessions(offset, signal);
  }, [offset, revision]));

  return <section className={styles.chatSidebar} aria-label="Manager chat sessions">
    <button className={`button ${styles.newChat}`} disabled={locked} onClick={onNew}>
      <span aria-hidden="true">＋</span> New portfolio chat
    </button>
    <WorkspaceNavigation />
    <details className={styles.history} open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}>
      <summary>Conversations</summary>
      <DataState {...sessions} retry={sessions.refresh}>
        {!sessions.data?.items.length && <p className={styles.muted}>Your conversations will appear here.</p>}
        <ul className={styles.sessions}>{sessions.data?.items.map(item => <li key={item.id}>
          <button className={styles.session} aria-pressed={sessionId === item.id}
            disabled={locked || item.origin === "scheduled" || item.account_id !== null}
            onClick={() => onSelect(item)}>
            <span>{item.title}</span><small>{timestamp(item.updated_at)}</small>
          </button>
        </li>)}</ul>
        {!!sessions.data && sessions.data.total > 20 && <div className={styles.row}>
          <button className="button" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous chats</button>
          <button className="button" disabled={offset + 20 >= sessions.data.total} onClick={() => setOffset(value => value + 20)}>More chats</button>
        </div>}
      </DataState>
    </details>
  </section>;
}
