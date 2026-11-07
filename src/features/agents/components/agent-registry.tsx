"use client";
import { useRemote } from "@/hooks/use-remote";
import { AppShell } from "@/components/layout/app-shell";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import styles from "@/components/ui/panels.module.css";
import { getAgents } from "../api";
import { AgentAvatar } from "./agent-avatar";
import agentStyles from "./agent-registry.module.css";
export function AgentRegistry() {
  const state = useRemote(getAgents);
  return (
    <AppShell title="Agent registry">
      <div className={styles.header}>
        <div>
          <div className={agentStyles.eyebrow}>YOUR AI TEAM</div>
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
        <div className={agentStyles.grid}>
          {state.data?.items.map((item) => (
            <article className={agentStyles.card} data-role={item.role} key={item.id}>
              <div className={agentStyles.portrait}>
                <AgentAvatar role={item.role} className={agentStyles.robot} />
                <span className={`${agentStyles.status} ${item.available ? "" : agentStyles.unavailable}`}>
                  {item.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <div className={agentStyles.body}>
                <div className={agentStyles.heading}>
                  <h2>{item.name}</h2>
                  <span className={agentStyles.role}>{item.role}</span>
                </div>
                <p className={agentStyles.description}>{item.description}</p>
                <div className={agentStyles.runtime}>
                  <span className={agentStyles.runtimeMode}>{item.runtime_mode}</span>
                  <span>{item.configured ? "Profile configured" : "Profile not configured"}</span>
                </div>
                {item.unavailable_reason && (
                  <p className={styles.notice}>{item.unavailable_reason}</p>
                )}
                <div className={agentStyles.capabilitiesLabel}>Capabilities</div>
                <div className={agentStyles.capabilities}>
                  {item.capabilities.length ? item.capabilities.map((capability) => (
                    <span className={agentStyles.capability} key={capability}>{capability}</span>
                  )) : <span className={styles.muted}>None reported</span>}
                </div>
                <p className={agentStyles.checked}>Checked: {timestamp(item.checked_at)}</p>
              </div>
            </article>
          ))}
        </div>
      </DataState>
    </AppShell>
  );
}
