"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { getReviews } from "@/features/reviews/api";
import { reasonLabel } from "@/features/compliance/reasons";
import { timestamp } from "@/lib/format";
import { getAutomationStatus } from "../api";
import type { AutomationStatus } from "../types";
import styles from "@/components/ui/panels.module.css";

function scanIsOverdue(status: AutomationStatus) {
  if (!status.enabled) return false;
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: status.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  if (localTime < status.daily_start_time) return false;
  return !status.last_scan_at || Date.now() - Date.parse(status.last_scan_at) > 10 * 60 * 1000;
}

export function AutomationSummary({ revision }: { revision: number }) {
  const automation = useRemote(useCallback((signal: AbortSignal) => {
    void revision;
    return getAutomationStatus(signal);
  }, [revision]));
  const reviews = useRemote(useCallback((signal: AbortSignal) => {
    void revision;
    return getReviews(0, "open", signal);
  }, [revision]));

  useEffect(() => {
    const timer = setInterval(() => {
      automation.refresh();
      reviews.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [automation.refresh, reviews.refresh]);

  return <section className={styles.panel} aria-label="Collection automation and human review">
    <h2>Daily collection</h2>
    <DataState {...automation} retry={automation.refresh}>
      {automation.data && <>
        <p>{automation.data.enabled ? "Enabled" : "Disabled"} · {automation.data.daily_start_time} {automation.data.timezone} · {automation.data.runtime_mode}</p>
        {scanIsOverdue(automation.data) && <p role="status">Worker scan is overdue. Check that the collection worker is running.</p>}
        <p>Business date {automation.data.business_date} · Last scan {timestamp(automation.data.last_scan_at)}</p>
        <div className={styles.row}>
          {Object.entries(automation.data.counts).map(([name, count]) => <span className={styles.badge} key={name}>{name.replaceAll("_", " ")} {count}</span>)}
        </div>
        {automation.data.attention_items.length > 0 && <ul>
          {automation.data.attention_items.map(item => <li key={item.id}>
            {item.account_id} · {item.reason_codes.map(reasonLabel).join(", ")}
            {item.run_id && <> · <Link href={`/runs/${encodeURIComponent(item.run_id)}`}>Inspect run</Link></>}
            {" · "}<Link href={`/accounts/${encodeURIComponent(item.account_id)}`}>Open account</Link>
          </li>)}
        </ul>}
      </>}
    </DataState>
    <h3>Needs human review</h3>
    <DataState {...reviews} retry={reviews.refresh}>
      {reviews.data && <>
        <p>{reviews.data.total} open reviews</p>
        <ul>{reviews.data.items.slice(0, 5).map(review => <li key={review.id}>
          <Link href={`/review?review=${encodeURIComponent(review.id)}`}>Review {review.reason.replaceAll("_", " ")} · {review.account_id}</Link>
        </li>)}</ul>
        <Link className="button" href="/review">Open review queue</Link>
      </>}
    </DataState>
  </section>;
}
