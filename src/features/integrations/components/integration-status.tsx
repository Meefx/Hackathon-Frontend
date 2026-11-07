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
              <h2>{item.id === "gmail" ? "Gmail API sandbox" : item.id}</h2>
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
                <p className={styles.notice}>
                  {item.disabled_reason === "gmail_not_configured"
                    ? "Configure OAuth credentials and a fixed team test recipient in the backend."
                    : item.disabled_reason}
                </p>
              )}
              {item.id === "gmail" && (
                <div>
                  <p>
                    Test emails use fixed synthetic content and the configured
                    team test mailbox.
                  </p>
                  {item.configured && (
                    <p>Connection health awaits a backend test.</p>
                  )}
                  <p>Run these commands from the backend terminal.</p>
                  <p className={styles.code}>
                    <code>
                      uv run python -m app.integrations.gmail authorize
                    </code>
                  </p>
                  <p className={styles.code}>
                    <code>
                      uv run python -m app.integrations.gmail send-test
                      --request-id 00000000-0000-4000-8000-000000000001
                    </code>
                  </p>
                  <p>
                    Reuse the request ID for an exact retry. Choose a fresh UUID
                    for each intentional new test.
                  </p>
                  <p>
                    A successful send-test confirms Gmail API acceptance.
                    Recipient delivery must be checked in the test mailbox.
                  </p>
                </div>
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
