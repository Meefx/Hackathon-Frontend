"use client";
import { useRemote } from "@/hooks/use-remote";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
import { getIntegrations } from "../api";
export function IntegrationStatusPanel() {
  const state = useRemote(getIntegrations);
  return (
    <AppShell title="Integrations">
      <div className={styles.header}>
        <div>
          <h1>Integrations</h1>
          <p>
            Current runtime, knowledge, guardrail, MCP and channel capabilities.
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
              <h2>{item.id}</h2>
              <div className={styles.row}>
                <span className={styles.badge}>{item.kind}</span>
                <span className={styles.badge}>{item.health}</span>
                <span className={styles.badge}>{item.execution_mode}</span>
              </div>
              <p>
                {item.implemented
                  ? "Adapter implemented"
                  : "Provider not implemented"}{" "}
                · {item.configured ? "Configured" : "Not configured"}
              </p>
              {item.disabled_reason && (
                <p className={styles.notice}>{item.disabled_reason}</p>
              )}
              <p>
                Capabilities: {item.capabilities.join(", ") || "None reported"}
              </p>
              <p className={styles.muted}>
                Checked: {timestamp(item.checked_at)}
                {item.checked_at &&
                Date.now() - new Date(item.checked_at).valueOf() > 300000
                  ? " · Status may be stale; refresh before relying on availability."
                  : ""}
              </p>
            </article>
          ))}
        </div>
      </DataState>
    </AppShell>
  );
}
