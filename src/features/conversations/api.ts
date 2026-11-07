import { get, post, type Page } from "@/lib/http";
import type { Message, InboundRequest, DispatchResult } from "./types";
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
) =>
  post<DispatchResult>(
    `/api/v1/messages/${encodeURIComponent(id)}/simulate-dispatch`,
    body,
  );
