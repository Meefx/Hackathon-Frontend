"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { getRuns } from "../api";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
export function RunHistory({ accountId }: { accountId: string }) {
  const [offset, setOffset] = useState(0);
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => getRuns(accountId, offset, signal),
      [accountId, offset],
    ),
  );
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>Run history</h2>
        <button className="button" onClick={state.refresh}>
          Refresh history
        </button>
      </div>
      <DataState
        {...state}
        retry={state.refresh}
        empty={!state.data?.items.length}
      >
        <ul className={styles.list}>
          {state.data?.items.map((run) => (
            <li key={run.id} className={styles.item}>
              <Link href={`/runs/${run.id}`} className={styles.link}>
                {run.id}
              </Link>
              <p>
                {run.status} · {run.outcome || run.phase} ·{" "}
                {run.actual_runtime_mode || run.requested_runtime_mode}
              </p>
              <small>{timestamp(run.created_at)}</small>
            </li>
          ))}
        </ul>
        <div className={styles.pagination}>
          <button
            className="button"
            disabled={!offset}
            onClick={() => setOffset(offset - 20)}
          >
            Previous runs
          </button>
          <button
            className="button"
            disabled={!state.data || offset + 20 >= state.data.total}
            onClick={() => setOffset(offset + 20)}
          >
            More runs
          </button>
        </div>
      </DataState>
    </section>
  );
}
