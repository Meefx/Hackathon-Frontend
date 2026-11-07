"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { errorMessage } from "@/lib/http";
import { timestamp } from "@/lib/format";
import { getGmailCollectionDemo, getGmailCollectionDemoStatus, startGmailCollectionDemo } from "../api";
import type { GmailCollectionDemo, GmailCollectionDemoStatus } from "../types";
import { readGmailDemoJournal, writeGmailDemoJournal } from "../gmail-demo-journal";
import styles from "@/components/ui/panels.module.css";

export function GmailCollectionDemoPanel() {
  const [configuration, setConfiguration] = useState<GmailCollectionDemoStatus | null>(null);
  const [demo, setDemo] = useState<GmailCollectionDemo | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<"simulated" | "hermes">("simulated");
  const [journal, setJournal] = useState<ReturnType<typeof readGmailDemoJournal>>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(false);
  const active = demo?.status === "queued" || demo?.status === "running";
  const uncertain = !!journal?.idempotencyKey && !journal.demoId;
  const demoId = demo?.id;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const saved = readGmailDemoJournal();
    setJournal(saved);
    if (saved) setRuntimeMode(saved.runtimeMode);
    setReady(false);
    setError("");
    async function load() {
      try {
        const status = await getGmailCollectionDemoStatus(controller.signal);
        if (controller.signal.aborted) return;
        setConfiguration(status);
        const restored = saved?.demoId
          ? await getGmailCollectionDemo(saved.demoId, controller.signal)
          : saved?.idempotencyKey ? null : status.latest;
        if (controller.signal.aborted) return;
        setDemo(restored);
        if (restored) {
          const next = { demoId: restored.id, idempotencyKey: saved?.idempotencyKey || null, runtimeMode: restored.runtime_mode };
          setJournal(next);
          setRuntimeMode(restored.runtime_mode);
          setStorageWarning(!writeGmailDemoJournal(next));
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      } finally {
        if (!controller.signal.aborted) setReady(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!demoId || !active) return;
    const id = demoId;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let delay = 1000;
      try {
        const value = await getGmailCollectionDemo(id, controller.signal);
        if (controller.signal.aborted) return;
        setDemo(value);
        setPollError("");
        if (value.status !== "queued" && value.status !== "running") return;
      } catch (reason) {
        if (controller.signal.aborted) return;
        setPollError(errorMessage(reason));
        delay = 3000;
      }
      timer = setTimeout(() => void poll(), delay);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [demoId, active]);

  async function start() {
    if (lock.current || !ready || !configuration?.configured || active) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const existingKey = uncertain ? journal?.idempotencyKey : null;
    const key = existingKey || crypto.randomUUID();
    const mode = existingKey && journal ? journal.runtimeMode : runtimeMode;
    const pending = { demoId: null, idempotencyKey: key, runtimeMode: mode };
    setJournal(pending);
    setDemo(null);
    setStorageWarning(!writeGmailDemoJournal(pending));
    try {
      const value = await startGmailCollectionDemo(key, mode);
      const accepted = { demoId: value.id, idempotencyKey: key, runtimeMode: mode };
      if (mounted.current || readGmailDemoJournal()?.idempotencyKey === key) {
        const stored = writeGmailDemoJournal(accepted);
        if (mounted.current) {
          setStorageWarning(!stored);
          setJournal(accepted);
          setDemo(value);
        }
      }
    } catch (reason) {
      if (mounted.current) setError(errorMessage(reason));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <section className={styles.item} aria-label="Gmail collection demo">
    <h3>Collection email demo</h3>
    <label>
      Email agent runtime
      <select value={runtimeMode} disabled={!ready || busy || active || uncertain} onChange={event => setRuntimeMode(event.target.value === "hermes" ? "hermes" : "simulated")}>
        <option value="simulated">Simulated</option>
        <option value="hermes">Hermes</option>
      </select>
    </label>
    <p><strong>{runtimeMode === "hermes" ? "Hermes agent runtime" : "Simulated agent runtime"}</strong> · Real Gmail test delivery</p>
    {runtimeMode === "hermes" && <p className={styles.muted}>Hermes drafts use demo screening restricted to synthetic test recipients. Configure the Hermes runtime and MCP connection in the backend.</p>}
    <p>Each new demo creates a synthetic borrower, prepares a collection draft, checks backend dispatch gates, and emails the fixed team test mailbox.</p>
    <p>Fixed test recipient <strong>{demo?.recipient_masked || configuration?.recipient_masked || "Not configured"}</strong></p>
    {!ready && <p role="status">Loading email demo status…</p>}
    {ready && configuration && !configuration.configured && <p className={styles.notice}>Configure Gmail credentials and a fixed team test recipient in the backend to run this demo.</p>}
    {demo && <div aria-live="polite">
      <p><span className={styles.badge}>{demo.status}</span> · {demo.runtime_mode}</p>
      <p className={styles.code}>Demo {demo.id}</p>
      <div className={styles.row}>
        <Link className={styles.link} href={`/accounts/${encodeURIComponent(demo.account_id)}`}>Open demo account</Link>
        <Link className={styles.link} href={`/runs/${encodeURIComponent(demo.run_id)}`}>Inspect email run</Link>
      </div>
      {demo.reason_codes.map(reason => <p className={styles.notice} key={reason}>{reason}</p>)}
      {demo.provider_message_id && <dl className={styles.facts}><div><dt>Gmail provider message ID</dt><dd>{demo.provider_message_id}</dd></div></dl>}
      <p className={styles.muted}>Updated {timestamp(demo.updated_at)}</p>
      {demo.status === "delivery_unknown" && <p className={styles.notice}>Delivery outcome is unknown. Check the test inbox before choosing another demo.</p>}
    </div>}
    <p>Submitted means Gmail API acceptance. Verify delivery in the configured test inbox.</p>
    {uncertain && !busy && <p className={styles.notice}>This email demo request is unconfirmed. Retry uses the saved request key to recover the same demo.</p>}
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {pollError && <p className={styles.notice} role="alert">Status update delayed. {pollError}</p>}
    {storageWarning && <p role="status">Browser storage is unavailable. Keep this page open to preserve email demo recovery.</p>}
    <div className={styles.row}>
      <button className="button primary" disabled={!ready || busy || active || !configuration?.configured || (!!journal?.demoId && !demo)} onClick={() => void start()}>
        {busy ? "Submitting email demo…" : active ? "Email demo in progress…" : uncertain ? "Retry same email demo" : demo ? "Run another email demo" : "Run email collection demo"}
      </button>
      <button className="button" disabled={busy || !ready || active} onClick={() => setRevision(value => value + 1)}>Refresh email demo status</button>
    </div>
  </section>;
}
