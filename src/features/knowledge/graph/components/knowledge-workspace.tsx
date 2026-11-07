"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { CATEGORY_ORDER, KNOWLEDGE_CATEGORIES } from "../categories";
import { getVisibleGraph, loadDemoGraph, RELATIONSHIPS } from "../graph-model";
import type { KnowledgeCategory, KnowledgeGraphData } from "../types";
import { GraphIcon } from "./graph-icon";
import { KnowledgeInspector } from "./knowledge-inspector";
import styles from "./knowledge-workspace.module.css";

const KnowledgeCanvas = dynamic(() => import("./knowledge-canvas").then(module => module.KnowledgeCanvas), {
  ssr: false,
  loading: () => <div className={styles.canvasLoading} role="status"><span className={styles.loadingGraph}><GraphIcon name="graph" size={36} /></span><strong>Connecting the dots…</strong><p>Preparing your knowledge canvas</p></div>,
});

export function KnowledgeWorkspace() {
  const [data, setData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<KnowledgeCategory[]>(CATEGORY_ORDER);
  const [relation, setRelation] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [focusOnly, setFocusOnly] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string; revision: number } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadDemoGraph().then(result => { if (active) setData(result); }).catch(() => {
      if (active) setError("The local knowledge source could not be loaded. Please try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const graph = useMemo(() => data ? getVisibleGraph(data, { categories, query, relation, selectedId, focusOnly }) : null, [data, categories, query, relation, selectedId, focusOnly]);
  const concept = data?.concepts.find(item => item.id === selectedId) ?? null;
  const selectedIsVisible = !!graph?.concepts.some(item => item.id === selectedId);

  const selectConcept = useCallback((id: string | null) => {
    setSelectedId(id);
    setFocusTarget(null);
    if (id) setDetailsOpen(true);
    if (!id) setFocusOnly(false);
  }, []);

  function navigateToConcept(id: string) {
    setQuery("");
    setRelation("all");
    setFocusOnly(false);
    setCategories(CATEGORY_ORDER);
    setSelectedId(id);
    setDetailsOpen(true);
    setSearchOpen(false);
    setFocusTarget(current => ({ id, revision: (current?.revision ?? 0) + 1 }));
  }

  function resetFilters() {
    setCategories(CATEGORY_ORDER);
    setQuery("");
    setRelation("all");
    setFocusOnly(false);
    setSelectedId(null);
    setFocusTarget(null);
    setSearchOpen(false);
  }

  function toggleCategory(category: KnowledgeCategory) {
    setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
    setSelectedId(null);
    setFocusOnly(false);
    setFocusTarget(null);
  }

  const hasFilters = categories.length !== CATEGORY_ORDER.length || !!query.trim() || relation !== "all" || focusOnly;

  return <AppShell title="Knowledge graph">
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.heading}><div className={styles.eyebrow}><GraphIcon name="graph" size={15} /> CONNECTED INTELLIGENCE</div><h1>Knowledge graph<span className={styles.titleDot}>.</span></h1><p>See the bigger picture behind every collection decision.</p></div>
        <div className={styles.metrics} aria-label="Knowledge source summary">
          <div><strong>{data?.concepts.length ?? "—"}</strong><span>Concepts</span></div><span className={styles.metricDivider} /><div><strong>{data?.relationships.length ?? "—"}</strong><span>Relationships</span></div><span className={styles.metricDivider} /><div><strong>6</strong><span>Categories</span></div>
        </div>
      </header>

      <div className={styles.demoNotice}><span className={styles.demoTag}><span /> SYNTHETIC DEMO</span><p>Explore illustrative policies, situations, and agent knowledge. All sources are local demo data.</p><GraphIcon name="info" size={16} /></div>

      <DataState loading={loading} error={error} retry={() => setRevision(value => value + 1)}>
        {data && graph && <section className={styles.explorer} aria-label="Knowledge explorer">
          <div className={styles.toolbar}>
            <div className={styles.searchArea} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
              <div className={styles.searchBox}><GraphIcon name="search" size={18} /><input type="search" aria-label="Search knowledge concepts" placeholder="Search concepts, rules, sources…" value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSelectedId(null); setFocusOnly(false); setFocusTarget(null); setSearchOpen(true); }} onKeyDown={event => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && graph.matches[0]) navigateToConcept(graph.matches[0].id); }} />{query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setSearchOpen(false); }}><GraphIcon name="close" size={14} /></button>}</div>
              {query.trim() && searchOpen && <div className={styles.searchResults} aria-label="Matching concepts"><span className={styles.resultsLabel}>{graph.matches.length} matching concept{graph.matches.length === 1 ? "" : "s"}</span>{graph.matches.slice(0, 6).map(match => <button type="button" key={match.id} onClick={() => navigateToConcept(match.id)}><GraphIcon name={match.category} size={16} style={{ color: KNOWLEDGE_CATEGORIES[match.category].color }} /><span>{match.title}<small>{KNOWLEDGE_CATEGORIES[match.category].singular}</small></span><GraphIcon name="arrow" size={14} /></button>)}{!graph.matches.length && <p>Try “hardship”, “verification”, or “policy”.</p>}</div>}
            </div>
            <div className={styles.toolbarOptions}>
              <label className={styles.relationSelect}><GraphIcon name="filter" size={15} /><span className={styles.srOnly}>Filter relationships</span><select value={relation} onChange={event => { setRelation(event.target.value); setSelectedId(null); setFocusOnly(false); setFocusTarget(null); }}><option value="all">All relationships</option>{RELATIONSHIPS.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className={styles.labelsToggle}><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} /><span>Edge labels</span></label>
              <button type="button" className={styles.detailsToggle} aria-pressed={detailsOpen} onClick={() => { setDetailsOpen(value => !value); if (detailsOpen) selectConcept(null); }}><GraphIcon name="info" size={15} />Details</button>
            </div>
          </div>
          <div className={styles.categoryBar}>
            <div className={styles.categoryList} role="group" aria-label="Filter knowledge categories">
              {CATEGORY_ORDER.map(category => { const meta = KNOWLEDGE_CATEGORIES[category]; const enabled = categories.includes(category); return <button type="button" key={category} aria-pressed={enabled} className={`${styles.categoryChip} ${enabled ? styles.categoryEnabled : ""}`} style={{ "--chip-color": meta.color, "--chip-background": meta.background } as React.CSSProperties} onClick={() => toggleCategory(category)}><span className={styles.categoryDot} />{meta.label}<span className={styles.categoryCount}>{data.concepts.filter(item => item.category === category).length}</span></button>; })}
            </div>
            {hasFilters && <button type="button" className={styles.resetFilters} onClick={resetFilters}>Reset filters</button>}
          </div>

          <div className={`${styles.graphColumns} ${!detailsOpen ? styles.graphExpanded : ""}`}>
            <div className={styles.graphArea}>
              <KnowledgeCanvas data={data} concepts={graph.concepts} relationships={graph.relationships} matches={graph.matches} selectedId={selectedIsVisible ? selectedId : null} showLabels={showLabels} focusTarget={focusTarget} onSelect={selectConcept} onResetFilters={resetFilters} />
              {concept && selectedIsVisible && <button type="button" aria-pressed={focusOnly} className={`${styles.focusButton} ${focusOnly ? styles.focusActive : ""}`} onClick={() => { setFocusTarget(null); setFocusOnly(value => !value); }}><GraphIcon name="focus" size={15} />{focusOnly ? "Show full graph" : "Focus connections"}</button>}
            </div>
            {detailsOpen && <KnowledgeInspector data={data} concept={concept} onSelect={navigateToConcept} onClose={() => { selectConcept(null); setDetailsOpen(false); }} />}
          </div>
          <footer className={styles.graphFooter}><span className={styles.statusCount} role="status" aria-live="polite"><span />{graph.concepts.length} of {data.concepts.length} concepts <span className={styles.footerSeparator}>·</span> {graph.relationships.length} relationships{query.trim() && <span className={styles.contextNote}> · matches + connected context</span>}</span><span className={styles.keyboardTip}>Tip: select a concept to follow its connections <GraphIcon name="arrow" size={13} /></span></footer>
        </section>}
      </DataState>
      <p className={styles.provenance}><GraphIcon name="layers" size={13} /> Knowledge connects context to action. Collection eligibility and dispatch remain enforced by the backend.</p>
    </div>
  </AppShell>;
}
