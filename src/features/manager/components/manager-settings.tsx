"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useManagerRuntime } from "../hooks/use-manager-runtime";
import styles from "./manager-chat.module.css";

const tools = [
  ["/portal", "Portfolio overview", "Balances, aging, and daily collection activity."],
  ["/accounts", "Accounts", "Search accounts and inspect their full history."],
  ["/review", "Human review", "Resolve escalations and review paused cases."],
  ["/agents", "Agents", "Specialist roles and backend availability."],
  ["/integrations", "Integrations", "Runtime connections, knowledge, and channel status."],
  ["/manager/tasks", "Advanced account tasks", "Direct task controls and legacy session histories."],
];

export function ManagerSettings() {
  const runtime = useManagerRuntime();
  return <AppShell title="Settings">
    <div className={styles.settings}>
      <header className={styles.header}>
        <div><h1>Settings</h1><p>Configure your manager and open detailed workspace tools.</p></div>
      </header>
      <section className={styles.settingsPanel} aria-label="Manager configuration">
        <h2>Manager runtime</h2>
        <p>The manager uses the backend-configured runtime by default. A preference applies to your next available chat turn.</p>
        <label className={styles.runtime}>Chat runtime
          <select disabled={runtime.loading} value={runtime.preference || "default"} onChange={event => runtime.changeMode(event.target.value === "default" ? null : event.target.value as "simulated" | "hermes")}>
            <option value="default">Backend default</option>
            <option value="hermes">Hermes</option>
            <option value="simulated">Simulated demo</option>
          </select>
        </label>
        <p role="status">{runtime.loading ? "Checking runtime…" : `${runtime.mode === "hermes" ? "Hermes" : "Simulated demo"} · ${runtime.available ? "Available" : "Unavailable"}`}</p>
        {runtime.mode === "simulated" && <p>Simulated mode displays synthetic responses and tool evidence. Free-form agent reasoning uses Hermes.</p>}
        {runtime.error && <p role="alert">{runtime.error}</p>}
        {runtime.storageWarning && <p role="status">Browser storage is unavailable. This runtime preference lasts while Settings stays open.</p>}
        <button className="button" onClick={runtime.refresh}>Recheck runtime</button>
      </section>
      <section aria-label="Workspace tools" className={styles.settingsGrid}>
        {tools.map(([href, label, description]) => <Link className={styles.settingsPanel} key={href} href={href} aria-label={label}>
          <h2>{label} <span aria-hidden="true">↗</span></h2><p>{description}</p>
        </Link>)}
      </section>
    </div>
  </AppShell>;
}
