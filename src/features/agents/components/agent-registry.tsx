"use client";
import { useRemote } from "@/hooks/use-remote";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
import { getAgents } from "../api";
export function AgentRegistry() {
  const state = useRemote(getAgents);
  return (
    <AppShell title="Agent registry">
      <div className={styles.header}>
        <div>
          <h1>Agent registry</h1>
          <p>
            Six specialist roles. Availability reflects the backend runtime.
          </p>
        </div>
        <button className="button" onClick={state.refresh}>
          Refresh status
        </button>
      </div>
      <DataState
        {...state}
        retry={state.refresh}
        empty={!state.data?.items.length}
      >
        <div className={styles.grid}>
          {state.data?.items.map((item) => (
            <article className={styles.panel} key={item.id}>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <div className={styles.row}>
                <span className={styles.badge}>{item.role}</span>
                <span className={styles.badge}>{item.runtime_mode}</span>
                <span className={styles.badge}>
                  {item.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <p>
                {item.configured
                  ? "Profile configured"
                  : "Profile not configured"}
              </p>
              {item.unavailable_reason && (
                <p className={styles.notice}>{item.unavailable_reason}</p>
              )}
              <p>
                Capabilities: {item.capabilities.join(", ") || "None reported"}
              </p>
              <p className={styles.muted}>
                Checked: {timestamp(item.checked_at)}
              </p>
            </article>
          ))}
        </div>
      </DataState>
    </AppShell>
  );
}
