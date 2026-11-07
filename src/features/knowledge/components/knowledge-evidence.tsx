"use client";

import { useCallback } from "react";
import Link from "next/link";
import { getKnowledgeHistory } from "../api";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import { reasonLabel } from "@/features/compliance/reasons";
import styles from "@/components/ui/panels.module.css";

function safeSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function citationAnchor(run: string, citation: string) {
  return `evidence-${encodeURIComponent(run)}-${encodeURIComponent(citation)}`;
}

export function KnowledgeEvidence({
  runId,
  citationIds = [],
}: {
  runId: string;
  citationIds?: string[];
}) {
  const state = useRemote(
    useCallback(
      (signal: AbortSignal) => getKnowledgeHistory(runId, signal),
      [runId],
    ),
  );
  const seen = new Set<string>();
  const snapshots = state.data || [];
  const allSources = snapshots.flatMap((snapshot) => snapshot.sources);
  return (
    <section className={styles.panel} aria-label="Knowledge evidence">
      <div className={styles.header}>
        <h2>Knowledge evidence</h2>
        <button className="button" onClick={state.refresh}>
          Refresh snapshots
        </button>
      </div>
      <p>
        Immutable snapshots used by this run. Retrieval does not refresh these
        sources.
      </p>
      <DataState {...state} retry={state.refresh}>
        {!snapshots.length && <p>No knowledge snapshots recorded.</p>}
        {citationIds
          .filter(
            (id) => !allSources.some((source) => source.citation_id === id),
          )
          .map((id) => (
            <p role="alert" className={styles.notice} key={id}>
              Citation {id} has no matching source in this run’s complete
              snapshot history. Backend validation determines whether this
              artifact is usable.
            </p>
          ))}
        {snapshots.map((snapshot) => (
          <article key={snapshot.id} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.badge}>{snapshot.status}</span>
              <span className={styles.badge}>{snapshot.source_mode}</span>
              <span className={styles.badge}>
                {snapshot.required ? "Required context" : "Optional context"}
              </span>
            </div>
            <p className={styles.muted}>
              Retrieved {timestamp(snapshot.retrieved_at)}
            </p>
            <p className={styles.code}>Snapshot {snapshot.snapshot_hash}</p>
            {snapshot.status !== "ready" && (
              <p className={styles.notice}>
                {snapshot.reason_code
                  ? reasonLabel(snapshot.reason_code)
                  : "No approved evidence is available for this snapshot."}{" "}
                <Link href="/integrations" className={styles.link}>
                  Knowledge integration status
                </Link>
              </p>
            )}
            <ul className={styles.list}>
              {snapshot.sources.map((source) => {
                const anchor = seen.has(source.citation_id)
                  ? undefined
                  : citationAnchor(runId, source.citation_id);
                seen.add(source.citation_id);
                const sourceUrl = safeSource(source.source_uri);
                return (
                  <li
                    className={`${styles.item} ${styles.section}`}
                    id={anchor}
                    key={`${source.citation_id}-${source.snippet_id}`}
                  >
                    <h3>{source.title}</h3>
                    <p className={styles.text}>{source.excerpt}</p>
                    <dl className={styles.facts}>
                      <div>
                        <dt>Document / version</dt>
                        <dd>
                          {source.document_id} / {source.document_version}
                        </dd>
                      </div>
                      <div>
                        <dt>Citation / snippet</dt>
                        <dd>
                          {source.citation_id} / {source.snippet_id}
                        </dd>
                      </div>
                      <div>
                        <dt>Approved</dt>
                        <dd>{timestamp(source.approved_at)}</dd>
                      </div>
                      <div>
                        <dt>Effective range</dt>
                        <dd>
                          {timestamp(source.effective_from)} –{" "}
                          {timestamp(source.effective_until)}
                        </dd>
                      </div>
                    </dl>
                    <p className={styles.code}>
                      Content hash {source.content_hash}
                    </p>
                    {sourceUrl ? (
                      <a
                        className={styles.link}
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open source
                      </a>
                    ) : (
                      <p className={styles.muted}>Source URL unavailable.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </DataState>
    </section>
  );
}
