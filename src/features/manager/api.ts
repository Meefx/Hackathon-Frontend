import { get, type Page } from "@/lib/http";
import type { ManagerSession, ManagerTurn } from "./types";
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
