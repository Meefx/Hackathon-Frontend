"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRemote } from "@/hooks/use-remote";
import { errorMessage } from "@/lib/http";
import { disconnectWhatsApp, getWhatsAppConnection, linkWhatsApp } from "../api";
import styles from "@/components/ui/panels.module.css";

export function WhatsAppConnectionPanel({
  accountId,
  revision,
  onChanged,
  onLinkedChange,
}: {
  accountId: string;
  revision: number;
  onChanged: () => void;
  onLinkedChange: (linked: boolean) => void;
}) {
  const connection = useRemote(
    useCallback((signal: AbortSignal) => {
      void revision;
      return getWhatsAppConnection(accountId, signal);
    }, [accountId, revision]),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    if (connection.data) onLinkedChange(connection.data.linked);
  }, [connection.data, onLinkedChange]);

  async function changeConnection() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (connection.data?.linked) {
        await disconnectWhatsApp(accountId);
      } else {
        requestKey.current ??= crypto.randomUUID();
        await linkWhatsApp(accountId, requestKey.current);
      }
      requestKey.current = null;
      connection.refresh();
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <h3>WhatsApp test channel</h3>
      <p>
        Link this synthetic case to the connected WhatsApp account’s own chat.
        New operator follow-up drafts can then be sent through WAHA after backend approval.
      </p>
      {connection.loading && <p role="status">Checking WhatsApp connection…</p>}
      {connection.error && <p role="alert">{errorMessage(connection.error)}</p>}
      {connection.data && (
        <>
          <p>
            Session <strong>{connection.data.session_status}</strong>
            {connection.data.recipient_masked && (
              <> · Test recipient {connection.data.recipient_masked}</>
            )}
          </p>
          {!connection.data.configured && (
            <p>Configure the WAHA collection sandbox in the backend to enable linking.</p>
          )}
          <button
            className="button"
            disabled={busy || !connection.data.configured || (
              !connection.data.linked && connection.data.session_status !== "WORKING"
            )}
            onClick={() => void changeConnection()}
          >
            {busy ? "Updating…" : connection.data.linked
              ? "Disconnect WhatsApp test channel" : "Connect WhatsApp test channel"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button className="button" disabled={busy} onClick={connection.refresh}>
        Refresh WhatsApp status
      </button>
    </div>
  );
}
