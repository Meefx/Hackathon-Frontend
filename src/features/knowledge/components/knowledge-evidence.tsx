"use client";

import { useState } from "react";
import Link from "next/link";
import { useKnowledgePages } from "@/features/knowledge/hooks/use-knowledge-pages";
import { SnapshotContext } from "@/features/knowledge/components/snapshot-context";
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
  runVersion,
  citationIds = [],
}: {
  runId: string;
  runVersion: number;
  citationIds?: string[];
}) {
  const state = useKnowledgePages(runId, runVersion);
  const [pageNumber, setPageNumber] = useState("1");
  const seen = new Set<string>();
  const snapshots = state.snapshots;
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
      <DataState
        loading={state.loading && !state.hasLoaded}
        error={!state.hasLoaded ? state.error : ""}
        retry={state.retry}
      >
        {state.error && (
          <p role="alert">
            {state.error}{" "}
            <button className="button" onClick={state.retry}>
              Retry snapshot page
            </button>
          </p>
        )}
        {state.hasMore && (
          <div className={styles.section}>
            <p>
              Loaded {snapshots.length} of {state.total} snapshots. Each request
              loads up to 20 snapshots.
            </p>
            <button
              className="button"
              disabled={state.loading}
              onClick={() => state.loadPage(state.nextPage)}
            >
              Load next snapshots
            </button>
            <form
              className={styles.row}
              onSubmit={(event) => {
                event.preventDefault();
                state.loadPage(Number(pageNumber));
              }}
            >
              <label>
                Snapshot page{" "}
                <input
                  type="number"
                  min="1"
                  max={state.pageCount}
                  value={pageNumber}
                  onChange={(event) => setPageNumber(event.target.value)}
                />
              </label>
              <span>of {state.pageCount}</span>
              <button className="button" disabled={state.loading}>
                Load snapshot page
              </button>
            </form>
          </div>
        )}
        {state.loading && state.hasLoaded && (
          <p role="status">Loading snapshot page…</p>
        )}
        {!snapshots.length && <p>No knowledge snapshots recorded.</p>}
        {citationIds
          .filter(
            (id) => !allSources.some((source) => source.citation_id === id),
          )
          .map((id) => (
            <p
              role={state.hasMore ? "status" : "alert"}
              className={styles.notice}
              key={id}
              id={citationAnchor(runId, id)}
            >
              {state.hasMore
                ? `Citation ${id} is awaiting unloaded snapshot pages. Load the next snapshots or select a snapshot page to find its source.`
                : `Citation ${id} has no matching source in this run’s complete snapshot history. Backend validation determines whether this artifact is usable.`}
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
            {snapshot.snapshot_hash_version && (
              <p className={styles.muted}>
                Snapshot hash version {snapshot.snapshot_hash_version}
              </p>
            )}
            <SnapshotContext snapshot={snapshot} />
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
                    {source.document_hash && (
                      <p className={styles.code}>
                        Document hash {source.document_hash}
                      </p>
                    )}
                    {source.snippet_hash && (
                      <p className={styles.code}>
                        Snippet hash {source.snippet_hash}
                      </p>
                    )}
                    {source.source_uri?.startsWith("synthetic://") && (
                      <p className={styles.code}>{source.source_uri}</p>
                    )}
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
