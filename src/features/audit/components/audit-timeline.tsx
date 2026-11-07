"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { getAudit } from "../api";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import { reasonLabel } from "@/features/compliance/reasons";
import styles from "@/components/ui/panels.module.css";
export function AuditTimeline({
  accountId,
  revision = 0,
}: {
  accountId: string;
  revision?: number;
}) {
  const [offset, setOffset] = useState(0);
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => {
        void revision;
        return getAudit(accountId, offset, signal);
      },
      [accountId, offset, revision],
    ),
  );
  return (
    <section className={styles.panel}>
      <h2>Audit timeline</h2>
      <p>Read-only history. Opening an event does not replay delivery.</p>
      <DataState
        {...state}
        retry={state.refresh}
        empty={!state.data?.items.length}
      >
        <ol className={styles.list}>
          {state.data?.items.map((event) => (
            <li className={styles.item} key={event.id}>
              <strong>
                {event.action} · {event.outcome}
              </strong>
              <p>
                {event.actor_kind} · {timestamp(event.created_at)}
              </p>
              {event.reason_codes.map((code) => (
                <p key={code}>{reasonLabel(code)}</p>
              ))}
              <p className={styles.code}>Correlation {event.correlation_id}</p>
              <details>
                <summary>Integrity references</summary>
                <p className={styles.code}>Event {event.event_hash}</p>
                <p className={styles.code}>
                  Previous {event.previous_hash || "Genesis"}
                </p>
              </details>
              {event.run_id && (
                <Link className={styles.link} href={`/runs/${event.run_id}`}>
                  Run evidence
                </Link>
              )}
            </li>
          ))}
        </ol>
        <div className={styles.pagination}>
          <button
            className="button"
            disabled={!offset}
            onClick={() => setOffset(offset - 20)}
          >
            Previous audit events
          </button>
          <button
            className="button"
            disabled={!state.data || offset + 20 >= state.data.total}
            onClick={() => setOffset(offset + 20)}
          >
            More audit events
          </button>
        </div>
      </DataState>
    </section>
  );
}
