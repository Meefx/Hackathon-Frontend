"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataState } from "@/components/ui/data-state";
import { useRemote } from "@/hooks/use-remote";
import { timestamp } from "@/lib/format";
import { getWhatsAppOutbound } from "../api";
import styles from "./whatsapp-message-feed.module.css";

const deliveryLabels: Record<string, string> = {
  submitted: "Submitted to WhatsApp",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  delivery_unknown: "Delivery unconfirmed",
};

export function WhatsAppMessageFeed({ revision }: { revision: number }) {
  const [offset, setOffset] = useState(0);
  const feed = useRemote(useCallback((signal: AbortSignal) => {
    void revision;
    return getWhatsAppOutbound(offset, signal);
  }, [offset, revision]));
  const pageSize = feed.data?.limit ?? 10;

  useEffect(() => {
    const timer = setInterval(feed.refresh, 15000);
    return () => clearInterval(timer);
  }, [feed.refresh]);

  return <section className={styles.panel} aria-labelledby="whatsapp-messages-title">
    <div className={styles.heading}>
      <div>
        <span className="eyebrow">WHATSAPP · OUTBOUND ACTIVITY</span>
        <h2 id="whatsapp-messages-title">Agent WhatsApp messages</h2>
        <p>See what the agent sent to borrowers, newest first. Updates every 15 seconds.</p>
      </div>
      <button type="button" className="button" onClick={feed.refresh}>Refresh messages</button>
    </div>
    <div aria-live="polite" aria-busy={feed.loading}>
      <DataState {...feed} retry={feed.refresh}>
        {feed.data && <>
          {feed.data.items.length === 0 ? <div className="empty-state">
            <h3>{offset ? "No messages on this page." : "No WhatsApp messages sent yet."}</h3>
            <p>WhatsApp dispatch attempts and their delivery status will appear here.</p>
          </div> : <ol className={styles.messages}>
            {feed.data.items.map(({ message, borrower_name, loan_reference }) => <li key={message.id} className={styles.message}>
              <div className={styles.metadata}>
                <div><strong>{borrower_name}</strong><span className={styles.reference}>{loan_reference}</span></div>
                <span className={styles.status} data-status={message.status}>{deliveryLabels[message.status] ?? message.status}</span>
              </div>
              <p className={styles.text}>{message.text}</p>
              <div className={styles.metadata}>
                <time dateTime={message.created_at}>Created {timestamp(message.created_at)}</time>
                <Link className="button" href={`/accounts/${encodeURIComponent(message.account_id)}#conversation`}>Open conversation</Link>
              </div>
            </li>)}
          </ol>}
          {feed.data.total > 0 && <p className={styles.total}>{feed.data.total} WhatsApp dispatch attempts</p>}
          {(offset > 0 || feed.data.total > feed.data.limit) && <div className={styles.pagination}>
            <button type="button" className="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous messages</button>
            <button type="button" className="button" disabled={offset + feed.data.limit >= feed.data.total} onClick={() => setOffset(offset + pageSize)}>Next messages</button>
          </div>}
        </>}
      </DataState>
    </div>
  </section>;
}
