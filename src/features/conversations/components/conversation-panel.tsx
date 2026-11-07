"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getMessages, addInbound, dispatchMessage } from "../api";
import type { InboundRequest, Message } from "../types";
import { getIntegrations } from "@/features/integrations/api";
import type { PolicyDecision } from "@/features/compliance/types";
import { reasonLabel } from "@/features/compliance/reasons";
import { useRemote } from "@/hooks/use-remote";
import { DataState } from "@/components/ui/data-state";
import { timestamp } from "@/lib/format";
import { ApiError, errorMessage } from "@/lib/http";
import styles from "@/components/ui/panels.module.css";
import { WhatsAppConnectionPanel } from "./whatsapp-connection";
export function ConversationPanel({
  accountId,
  policy,
  revision,
  onChanged,
}: {
  accountId: string;
  policy: PolicyDecision | null;
  revision: number;
  onChanged: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [text, setText] = useState("");
  const [scenario, setScenario] = useState("reminder");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [whatsappLinked, setWhatsAppLinked] = useState(false);
  const lock = useRef(false);
  const pending = useRef<
    | { kind: "inbound"; body: InboundRequest }
    | {
        kind: "dispatch";
        id: string;
        channel: Message["channel"];
        body: { idempotency_key: string; expected_message_version: number };
      }
    | null
  >(null);
  const messages = useRemote(
    useCallback(
      (signal: AbortSignal) => {
        void revision;
        return getMessages(accountId, offset, signal);
      },
      [accountId, offset, revision],
    ),
  );
  const integrations = useRemote(getIntegrations);
  useEffect(() => {
    if (!whatsappLinked) return;
    const timer = setInterval(() => {
      messages.refresh();
      onChanged();
    }, 5000);
    return () => clearInterval(timer);
  }, [whatsappLinked, messages.refresh, onChanged]);
  const channel = integrations.data?.items.find(
    (item) => item.id === "simulated_chat",
  );
  const canDispatch =
    !!policy?.allowed && channel?.health === "healthy" && channel.implemented;
  const canDispatchWhatsApp =
    !!policy?.allowed && integrations.data?.items.some(
      (item) => item.id === "whatsapp" && item.configured,
    );
  async function perform(message?: Message) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResult("");
    const action =
      pending.current ||
      (message
        ? {
            kind: "dispatch" as const,
            id: message.id,
            channel: message.channel,
            body: {
              idempotency_key: crypto.randomUUID(),
              expected_message_version: message.version,
            },
          }
        : {
            kind: "inbound" as const,
            body: {
              text: text.trim(),
              idempotency_key: crypto.randomUUID(),
              demo_scenario: scenario as InboundRequest["demo_scenario"],
            },
          });
    pending.current = action;
    try {
      if (action.kind === "inbound") {
        await addInbound(accountId, action.body);
        setResult("Simulated inbound received.");
        setText("");
      } else {
        const value = await dispatchMessage(action.id, action.body, action.channel);
        setResult(
          `${value.status}: ${value.reason_codes.map(reasonLabel).join("; ") || "Backend dispatch decision confirmed"}`,
        );
      }
      pending.current = null;
      messages.refresh();
      onChanged();
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof ApiError && reason.status < 500) {
        pending.current = null;
        messages.refresh();
        onChanged();
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={styles.panel}>
      <h2>Conversation</h2>
      <p>
        Dispatch decisions are enforced by the backend. Channel availability is shown in{" "}
        <Link className={styles.link} href="/integrations">
          Integrations
        </Link>
        .
      </p>
      <WhatsAppConnectionPanel
        key={accountId}
        accountId={accountId}
        revision={revision}
        onChanged={onChanged}
        onLinkedChange={setWhatsAppLinked}
      />
      {integrations.error && (
        <p className={styles.notice}>
          Channel availability could not be checked. Dispatch is disabled.{" "}
          <button className="button" onClick={integrations.refresh}>
            Retry channel status
          </button>
        </p>
      )}
      <DataState
        {...messages}
        retry={messages.refresh}
        empty={!messages.data?.items.length}
      >
        <ol className={styles.list}>
          {messages.data?.items.map((message) => (
            <li
              className={styles.item}
              key={message.id}
              id={`message-${encodeURIComponent(message.id)}`}
            >
              <div className={styles.row}>
                <strong>{message.direction}</strong>
                <span className={styles.badge}>{message.status}</span>
                <span className={styles.badge}>{message.channel}</span>
                <span className={styles.muted}>v{message.version}</span>
              </div>
              <p className={styles.text}>{message.text}</p>
              <p className={styles.muted}>{timestamp(message.created_at)}</p>
              <div className={styles.row}>
                {message.run_id && (
                  <Link
                    className={styles.link}
                    href={`/runs/${message.run_id}`}
                  >
                    Run & citation evidence
                  </Link>
                )}
                {message.citation_ids.map((id) => (
                  <span className={styles.badge} key={id}>
                    {id}
                  </span>
                ))}
                {message.status === "draft" && message.channel === "email" && (
                  <p className={styles.muted}>Email demo delivery is managed automatically.</p>
                )}
                {message.status === "draft" && message.channel !== "email" && (
                  <button
                    className="button"
                    disabled={
                      !(message.channel === "whatsapp" ? canDispatchWhatsApp : canDispatch)
                      || busy || !!pending.current
                    }
                    onClick={() => perform(message)}
                  >
                    {message.channel === "whatsapp" ? "Send WhatsApp test" : "Simulate dispatch"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.pagination}>
          <button
            className="button"
            disabled={!offset}
            onClick={() => setOffset(offset - 20)}
          >
            Previous messages
          </button>
          <button
            className="button"
            disabled={!messages.data || offset + 20 >= messages.data.total}
            onClick={() => setOffset(offset + 20)}
          >
            More messages
          </button>
        </div>
      </DataState>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void perform();
        }}
      >
        <h3>Simulate inbound</h3>
        <label>
          Borrower message
          <textarea
            value={text}
            required
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            disabled={busy || !!pending.current}
          />
        </label>
        <label>
          Demo inbound scenario
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            disabled={busy || !!pending.current}
          >
            <option value="reminder">General reply</option>
            <option value="hardship">Hardship</option>
            <option value="dispute">Dispute</option>
            <option value="human_request">Human request</option>
          </select>
        </label>
        <div>
          <button
            className="button"
            type="submit"
            disabled={busy || !text.trim() || !!pending.current}
          >
            Receive simulated inbound
          </button>
        </div>
      </form>
      {pending.current && !busy && (
        <p className={styles.notice}>
          The response was lost or unavailable.{" "}
          <button className="button" onClick={() => perform()}>
            Retry same conversation action
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className={styles.notice}>
          {error}
        </p>
      )}
      {result && (
        <p role="status" className={styles.notice}>
          {result}
        </p>
      )}
    </section>
  );
}
