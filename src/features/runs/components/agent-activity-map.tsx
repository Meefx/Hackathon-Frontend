"use client";

import { useState } from "react";
import { timestamp } from "@/lib/format";
import { activityStatusLabels, buildActivityNodes, type ActivityNode } from "../activity-model";
import type { RunActivityState, RunSnapshot } from "../types";
import styles from "./agent-activity-map.module.css";

export function AgentActivityMap({ run, activity, onRefresh }: {
  run: RunSnapshot;
  activity: RunActivityState;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState("manager");
  const nodes = buildActivityNodes(run, activity);
  const selected = nodes.find(node => node.id === selectedId) || nodes[0];
  const simulated = run.actual_runtime_mode === "simulated";
  const unverified = !simulated && (activity.status === "unavailable" || !!activity.error);
  const working = nodes.filter(node => node.status === "working").length;

  function renderNode(node: ActivityNode) {
    const children = nodes.filter(child => child.parentId === node.id);
    return <li className={styles.branch} key={node.id}>
      <button
        type="button"
        className={styles.node}
        data-status={node.status}
        aria-label={`${node.name} · ${activityStatusLabels[node.status]}`}
        aria-pressed={selected.id === node.id}
        onClick={() => setSelectedId(node.id)}
      >
        <span className={styles.nodeHeading}>
          <span className={styles.avatar} aria-hidden="true">{node.id === "manager" ? "M" : simulated ? "S" : "A"}</span>
          <span className={styles.identity}><small>{node.id === "manager" ? "Parent agent" : simulated ? "Recorded step" : "Child agent"}</small><strong>{node.name}</strong></span>
        </span>
        <span className={styles.status}><span className={styles.dot} aria-hidden="true" />{activityStatusLabels[node.status]}</span>
        {node.tools.length > 0 && <span className={styles.tool}>Tool · {node.tools.join(" · ")}</span>}
      </button>
      {children.length > 0 && <ul className={styles.children}>{children.map(renderNode)}</ul>}
    </li>;
  }

  return <section className={styles.map} aria-label="Agent activity map">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Execution observatory</p><h2>Agent activity map</h2></div>
      <span className={styles.source}>{simulated ? "Simulated evidence" : activity.source === "hermes" ? "Hermes runtime" : "Backend run state"}</span>
    </header>
    <div className={styles.summary} role="status">
      <span><span className={styles.summaryDot} aria-hidden="true" />{simulated ? `${run.steps.length} recorded ${run.steps.length === 1 ? "step" : "steps"}` : unverified ? `Run status · ${run.status}` : `${working} ${working === 1 ? "agent" : "agents"} working`}</span>
      <span>{simulated ? "Step timing is simulated and has no meaningful duration." : "Select an agent to inspect its latest evidence."}</span>
    </div>
    {unverified && <div className={styles.notice} role="status">
      <strong>Activity unverified</strong>
      <p>Live telemetry is unavailable. Run status and last confirmed evidence remain visible.</p>
      <button type="button" className={styles.retry} onClick={onRefresh}>Refresh activity</button>
    </div>}
    {!simulated && activity.truncated && <p className={styles.notice}>Runtime history is truncated. Earlier activity and parent relationships may be missing.</p>}
    {!simulated && activity.loading && <p className={styles.hint} role="status">Checking runtime activity…</p>}
    {!simulated && !activity.loading && nodes.length === 1 && <p className={styles.hint}>No confirmed subagent activity has been reported.</p>}
    {!simulated && activity.status === "not_started" && !activity.loading && <p className={styles.hint}>Runtime activity has not started.</p>}
    <div className={styles.content}>
      <div className={styles.tree}>
        <ul className={styles.roots} aria-label="Agent hierarchy">{nodes.filter(node => node.parentId === null).map(renderNode)}</ul>
      </div>
      <aside className={styles.detail} aria-label="Selected agent details">
        <p className={styles.eyebrow}>Selected {simulated && selected.id !== "manager" ? "step" : "agent"}</p>
        <h3>{selected.name}</h3>
        <dl>
          <div><dt>Status</dt><dd>{activityStatusLabels[selected.status]}</dd></div>
          <div><dt>{simulated && selected.id !== "manager" ? "Step ID" : "Agent ID"}</dt><dd className={styles.code}>{simulated && selected.id !== "manager" ? selected.id.replace(/^step-/, "") : selected.id}</dd></div>
          {selected.parentId && <div><dt>Parent ID</dt><dd className={styles.code}>{selected.parentId}</dd></div>}
          <div><dt>Last {simulated ? "evidence" : "event"}</dt><dd>{selected.lastEvent}</dd></div>
          <div><dt>Recorded time</dt><dd>{timestamp(selected.recordedAt)}</dd></div>
          {selected.tools.length > 0 && <div><dt>Current tool</dt><dd>{selected.tools.join(" · ")}</dd></div>}
        </dl>
        {selected.note && <p className={styles.hint}>{selected.note}</p>}
        {!simulated && <p className={styles.hint}>Subagent names and tool attribution follow reported runtime events.</p>}
      </aside>
    </div>
  </section>;
}
