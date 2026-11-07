"use client";
import { useCallback, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { useRemote } from "@/hooks/use-remote";
import { timestamp } from "@/lib/format";
import { getReviews } from "../api";
import { ReviewDetail } from "./review-detail";
import styles from "@/components/ui/panels.module.css";
export function ReviewQueue() {
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("open");
  const [selected, setSelected] = useState<string | null>(null);
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => getReviews(offset, status, signal),
      [offset, status],
    ),
  );
  return (
    <AppShell title="Human review">
      <div className={styles.header}>
        <div>
          <h1>Human review</h1>
          <p>Resolve escalations and inspect the backend contact decision.</p>
        </div>
        <button className="button" onClick={state.refresh}>
          Refresh queue
        </button>
      </div>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <label className={styles.row}>
            Review status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="">All reviews</option>
            </select>
          </label>
          <DataState
            {...state}
            retry={state.refresh}
            empty={!state.data?.items.length}
          >
            <ul className={styles.list}>
              {state.data?.items.map((review) => (
                <li className={styles.item} key={review.id}>
                  <div className={styles.header}>
                    <div>
                      <strong>{review.reason.replaceAll("_", " ")}</strong>
                      <p>
                        {review.account_id} · {review.status}
                      </p>
                      <small>{timestamp(review.created_at)}</small>
                    </div>
                    <button
                      className="button"
                      aria-pressed={selected === review.id}
                      onClick={() => setSelected(review.id)}
                    >
                      Open review
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.pagination}>
              <button
                className="button"
                disabled={!offset}
                onClick={() => setOffset(offset - 20)}
              >
                Previous reviews
              </button>
              <button
                className="button"
                disabled={!state.data || offset + 20 >= state.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                More reviews
              </button>
            </div>
          </DataState>
        </section>
        {selected && (
          <ReviewDetail
            key={selected}
            id={selected}
            onChanged={state.refresh}
          />
        )}
      </div>
    </AppShell>
  );
}
