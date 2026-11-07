import { get, post, type Page } from "@/lib/http";
import type { Message, InboundRequest, DispatchResult, WhatsAppConnection, WhatsAppOutboundItem } from "./types";

export const getWhatsAppOutbound = (offset = 0, signal?: AbortSignal) =>
  get<Page<WhatsAppOutboundItem>>(`/api/v1/whatsapp/messages?limit=10&offset=${offset}`, signal);
export const getMessages = (
  account: string,
  offset = 0,
  signal?: AbortSignal,
) =>
  get<Page<Message>>(
    `/api/v1/accounts/${encodeURIComponent(account)}/messages?offset=${offset}&limit=20`,
    signal,
  );
export const addInbound = (account: string, body: InboundRequest) =>
  post<Message>(
    `/api/v1/accounts/${encodeURIComponent(account)}/messages`,
    body,
  );
export const dispatchMessage = (
  id: string,
  body: { idempotency_key: string; expected_message_version: number },
  channel: Message["channel"] = "simulated_chat",
) =>
  post<DispatchResult>(
    `/api/v1/messages/${encodeURIComponent(id)}/${channel === "whatsapp" ? "dispatch" : "simulate-dispatch"}`,
    body,
  );

export const getWhatsAppConnection = (accountId: string, signal?: AbortSignal) =>
  get<WhatsAppConnection>(`/api/v1/accounts/${encodeURIComponent(accountId)}/whatsapp`, signal);

export const linkWhatsApp = (accountId: string, idempotencyKey: string) =>
  post<WhatsAppConnection>(`/api/v1/accounts/${encodeURIComponent(accountId)}/whatsapp`, { idempotency_key: idempotencyKey });

export const disconnectWhatsApp = (accountId: string) =>
  post<WhatsAppConnection>(`/api/v1/accounts/${encodeURIComponent(accountId)}/whatsapp/disconnect`, {});
