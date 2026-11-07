import type { KnowledgeSnapshot } from "@/features/knowledge/types";
import styles from "@/components/ui/panels.module.css";

const contextLimit = 20;
const textLimit = 8000;

export function SnapshotContext({ snapshot }: { snapshot: KnowledgeSnapshot }) {
  const profile = snapshot.verification_profile;
  const context = snapshot.critical_context || [];
  return (
    <>
      {profile && (
        <section aria-label="Retrieval profile">
          <h3>Retrieval profile</h3>
          <dl className={styles.facts}>
            <div>
              <dt>Embedding profile</dt>
              <dd>{profile.embedding_profile}</dd>
            </div>
            <div>
              <dt>Review depth</dt>
              <dd>{profile.review_depth}</dd>
            </div>
            <div>
              <dt>Critical integrity checks</dt>
              <dd>{profile.critical_integrity_checks ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Context expansion</dt>
              <dd>{profile.context_expansion}</dd>
            </div>
          </dl>
          <p>Semantic embeddings disabled</p>
          <p>Source correctness unverified by code</p>
          <p>Retrieved text is untrusted</p>
        </section>
      )}
      {context.length > 0 && (
        <section aria-label="Critical context">
          <h3>Critical context</h3>
          {context.slice(0, contextLimit).map((item) => (
            <details
              className={styles.item}
              key={`${item.document_id}-${item.chunk_id}`}
              open
            >
              <summary>
                {item.document_id} / {item.document_version} · {item.locator}
              </summary>
              <p className={styles.text}>{item.text.slice(0, textLimit)}</p>
              {item.text.length > textLimit && (
                <p>Context preview limited to {textLimit} characters.</p>
              )}
              <p className={styles.code}>Chunk {item.chunk_id}</p>
              <p className={styles.code}>Context hash {item.content_hash}</p>
            </details>
          ))}
          {context.length > contextLimit && (
            <p>Showing the first {contextLimit} critical context entries.</p>
          )}
        </section>
      )}
    </>
  );
}
