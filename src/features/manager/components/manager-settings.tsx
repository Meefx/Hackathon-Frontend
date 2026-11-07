"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useManagerRuntime } from "../hooks/use-manager-runtime";
import styles from "./manager-chat.module.css";

export function ManagerSettings() {
  const runtime = useManagerRuntime();
  return <AppShell title="Settings">
    <div className={styles.settings}>
      <header className={styles.header}>
        <div><h1>Settings</h1><p>Configure your manager runtime preferences.</p></div>
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
    </div>
  </AppShell>;
}
