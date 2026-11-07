"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { getSessions, getTurns } from "../api";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
function Turns({ id }: { id: string }) {
  const [offset, setOffset] = useState(0);
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => getTurns(id, offset, signal),
      [id, offset],
    ),
  );
  return (
    <DataState
      {...state}
      retry={state.refresh}
      empty={!state.data?.items.length}
    >
      <ol className={styles.list}>
        {state.data?.items.map((turn) => (
          <li className={styles.item} key={turn.id}>
            <strong>
              {turn.role} · Turn {turn.turn_index}
            </strong>
            <p className={styles.text}>{turn.content}</p>
            <small>
              {timestamp(turn.created_at)}{" "}
              {turn.run_id && (
                <Link className={styles.link} href={`/runs/${turn.run_id}`}>
                  Open run
                </Link>
              )}
            </small>
          </li>
        ))}
      </ol>
      <div className={styles.row}>
        <button
          className="button"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Earlier turns
        </button>
        <button
          className="button"
          disabled={!state.data || offset + 20 >= state.data.total}
          onClick={() => setOffset(offset + 20)}
        >
          Later turns
        </button>
      </div>
    </DataState>
  );
}
export function SessionHistory({
  account,
  selected,
  onSelect,
}: {
  account: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [offset, setOffset] = useState(0);
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => getSessions(account, offset, signal),
      [account, offset],
    ),
  );
  return (
    <section className={styles.panel}>
      <h2>Manager sessions</h2>
      <button className="button" onClick={() => onSelect(null)}>
        New session
      </button>
      <DataState
        {...state}
        retry={state.refresh}
        empty={!state.data?.items.length}
      >
        <ul className={styles.list}>
          {state.data?.items.map((session) => (
            <li className={styles.item} key={session.id}>
              <button
                className="button"
                aria-pressed={selected === session.id}
                onClick={() => onSelect(session.id)}
              >
                {session.title}
              </button>
              <p className={styles.muted}>{timestamp(session.updated_at)}</p>
              {selected === session.id && <Turns id={session.id} />}
            </li>
          ))}
        </ul>
        <div className={styles.row}>
          <button
            className="button"
            disabled={!offset}
            onClick={() => setOffset(offset - 20)}
          >
            Previous sessions
          </button>
          <button
            className="button"
            disabled={!state.data || offset + 20 >= state.data.total}
            onClick={() => setOffset(offset + 20)}
          >
            More sessions
          </button>
        </div>
      </DataState>
    </section>
  );
}
