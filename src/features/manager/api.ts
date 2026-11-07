import { get, post, type Page } from "@/lib/http";
import type { RunAccepted } from "@/features/runs/types";
import type { ChatRunRequest, ManagerSession, ManagerTurn } from "./types";
export const getSessions = (
  account: string,
  offset = 0,
  signal?: AbortSignal,
) =>
  get<Page<ManagerSession>>(
    `/api/v1/accounts/${encodeURIComponent(account)}/manager-sessions?offset=${offset}&limit=20`,
    signal,
  );
export const getTurns = (id: string, offset = 0, signal?: AbortSignal) =>
  get<Page<ManagerTurn>>(
    `/api/v1/manager-sessions/${encodeURIComponent(id)}/messages?offset=${offset}&limit=20`,
    signal,
  );

export const getChatSessions = (offset = 0, signal?: AbortSignal) =>
  get<Page<ManagerSession>>(`/api/v1/manager/chat/sessions?limit=20&offset=${offset}`, signal);
export const startChatRun = (body: ChatRunRequest) =>
  post<RunAccepted>("/api/v1/manager/chat/runs", body);
export const getChatRequest = (key: string, signal?: AbortSignal) =>
  get<RunAccepted>(`/api/v1/manager/chat/requests/${encodeURIComponent(key)}`, signal);

export const getChatSession = (id: string, signal?: AbortSignal) =>
  get<ManagerSession>(`/api/v1/manager/chat/sessions/${encodeURIComponent(id)}`, signal);
