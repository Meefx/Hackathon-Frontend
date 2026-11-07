"use client";

import { useId } from "react";
import { KNOWLEDGE_CATEGORIES } from "@/features/knowledge/graph/categories";
import type { KnowledgeConcept, KnowledgeGraphData } from "@/features/knowledge/graph/types";
import { GraphIcon } from "@/features/knowledge/graph/components/graph-icon";
import styles from "./knowledge-inspector.module.css";

interface KnowledgeInspectorProps {
  data: KnowledgeGraphData;
  concept: KnowledgeConcept | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function KnowledgeInspector({ data, concept, onSelect, onClose }: KnowledgeInspectorProps) {
  const headingId = useId();
  const conceptById = new Map(data.concepts.map((item) => [item.id, item]));
  const relationships = concept
    ? data.relationships.filter((relationship) =>
      (relationship.source === concept.id || relationship.target === concept.id)
      && conceptById.has(relationship.source)
      && conceptById.has(relationship.target))
    : [];
  const sources = concept ? data.sources.filter((source) => concept.sourceIds.includes(source.id)) : [];
  const examples = [
    data.concepts.find((item) => item.id === "responsible-collection")
      ?? data.concepts.find((item) => item.category === "policy"),
    data.concepts.find((item) => item.id === "financial-hardship")
      ?? data.concepts.find((item) => item.category === "situation"),
  ].filter((item): item is KnowledgeConcept => Boolean(item));

  return (
    <aside className={styles.inspector} aria-labelledby={headingId}>
      <header className={styles.header}>
        <span id={headingId} className={styles.eyebrow}>Concept details</span>
        {concept && (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close concept details" title="Close details">
            <GraphIcon name="close" size={16} />
          </button>
        )}
      </header>

      <div className={styles.scrollArea} key={concept?.id ?? "empty"}>
        {concept ? (
          <>
            <section className={styles.overview} aria-label="Selected concept">
              <span
                className={styles.categoryIcon}
                style={{ color: KNOWLEDGE_CATEGORIES[concept.category].color, background: KNOWLEDGE_CATEGORIES[concept.category].background }}
              >
                <GraphIcon name={concept.category} size={23} />
              </span>
              <span className={styles.categoryLabel} style={{ color: KNOWLEDGE_CATEGORIES[concept.category].color }}>
                {KNOWLEDGE_CATEGORIES[concept.category].singular}
              </span>
              <h2 className={styles.conceptTitle}>{concept.title}</h2>
              <p className={styles.description}>{concept.description}</p>
              {concept.tags.length > 0 && (
                <ul className={styles.tags} aria-label="Concept tags">
                  {concept.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}
              <div className={styles.metrics}>
                <span><strong>{relationships.length}</strong> connections</span>
                <span><strong>{sources.length}</strong> {sources.length === 1 ? "source" : "sources"}</span>
              </div>
            </section>

            <section className={styles.section} aria-label="Source references">
              <div className={styles.sectionHeading}>
                <h3>Source references</h3>
                <span className={styles.count}>{sources.length}</span>
              </div>
              <p className={styles.sectionHint}>The context behind this concept.</p>
              <div className={styles.sources}>
                {sources.map((source) => (
                  <details className={styles.source} key={source.id}>
                    <summary>
                      <GraphIcon name="document" size={17} />
                      <span><strong>{source.title}</strong><small>{source.kind} · {source.version}</small></span>
                      <GraphIcon name="chevron" size={14} className={styles.sourceChevron} />
                    </summary>
                    <div className={styles.sourceContent}>
                      <blockquote>{source.excerpt}</blockquote>
                      <span className={styles.referenceLabel}>Reference</span>
                      <code>{source.reference}</code>
                    </div>
                  </details>
                ))}
                {sources.length === 0 && <p className={styles.emptySection}>No source references attached.</p>}
              </div>
            </section>

            <section className={styles.section} aria-label="Connected concepts">
              <div className={styles.sectionHeading}>
                <h3>Connections</h3>
                <span className={styles.count}>{relationships.length}</span>
              </div>
              <p className={styles.sectionHint}>Follow a connection to explore the graph.</p>
              {relationships.length > 0 ? (
                <ul className={styles.connections}>
                  {relationships.map((relationship) => {
                    const outgoing = relationship.source === concept.id;
                    const source = conceptById.get(relationship.source)!;
                    const target = conceptById.get(relationship.target)!;
                    const related = outgoing ? target : source;
                    const category = KNOWLEDGE_CATEGORIES[related.category];

                    return (
                      <li key={relationship.id}>
                        <button
                          type="button"
                          className={styles.connection}
                          onClick={() => onSelect(related.id)}
                          aria-label={`Explore ${related.title}. ${outgoing ? "Outgoing" : "Incoming"} connection: ${source.title} → ${relationship.relation} → ${target.title}. ${relationship.description}`}
                        >
                          <span className={styles.connectionTop}>
                            <span className={styles.direction}>{outgoing ? "Outgoing" : "Incoming"}</span>
                            <GraphIcon name="arrow" size={14} />
                          </span>
                          <span className={styles.connectionTitle}>
                            <GraphIcon name={related.category} size={16} style={{ color: category.color }} />
                            <strong>{related.title}</strong>
                          </span>
                          <span className={styles.relationshipPath}>
                            {source.title} <span aria-hidden="true">→</span> <b>{relationship.relation}</b> <span aria-hidden="true">→</span> {target.title}
                          </span>
                          <span className={styles.connectionDescription}>{relationship.description}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className={styles.emptySection}>No connections for this concept.</p>}
            </section>
          </>
        ) : (
          <section className={styles.emptyState}>
            <div className={styles.emptyIllustration} aria-hidden="true">
              <span className={styles.orbitDot} />
              <span className={styles.orbitDot} />
              <span className={styles.orbitDot} />
              <span className={styles.emptyIcon}><GraphIcon name="graph" size={32} /></span>
            </div>
            <span className={styles.emptyEyebrow}>Every connection has context</span>
            <h2>Explore the knowledge</h2>
            <p>Select a concept to see what it means, how it connects, and the sources behind it.</p>
            {examples.length > 0 && (
              <div className={styles.examples}>
                <span className={styles.exampleLabel}>A good place to start</span>
                {examples.map((example) => (
                  <button type="button" key={example.id} onClick={() => onSelect(example.id)}>
                    <GraphIcon name={example.category} size={17} style={{ color: KNOWLEDGE_CATEGORIES[example.category].color }} />
                    <span>{example.title}</span>
                    <GraphIcon name="arrow" size={15} />
                  </button>
                ))}
              </div>
            )}
            <div className={styles.tip}>
              <GraphIcon name="info" size={16} />
              <p>Drag to move around. Scroll to zoom. Use search to find a specific concept.</p>
            </div>
          </section>
        )}

        <footer className={styles.notice}>
          <span className={styles.syntheticBadge}><span /> Synthetic knowledge</span>
          <p>This illustrative graph explains the demo. Contact and compliance rules are enforced by the backend.</p>
        </footer>
      </div>
    </aside>
  );
}
