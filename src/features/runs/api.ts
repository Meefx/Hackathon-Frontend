import { get, post, query, type Page } from "@/lib/http";
import type {
  RunSnapshot,
  StartRunRequest,
  RunAccepted,
  EventPage,
  VersionAction,
} from "./types";
export const startRun = (account: string, body: StartRunRequest) =>
  post<RunAccepted>(
    `/api/v1/accounts/${encodeURIComponent(account)}/runs`,
    body,
  );
export const getRun = (id: string, signal?: AbortSignal) =>
  get<RunSnapshot>(`/api/v1/runs/${encodeURIComponent(id)}`, signal);
export const getRuns = (
  account: string,
  offset = 0,
  signal?: AbortSignal,
  requestKey?: string,
) =>
  get<Page<RunSnapshot>>(
    `/api/v1/accounts/${encodeURIComponent(account)}/runs?${query({ offset, limit: 20, request_key: requestKey })}`,
    signal,
  );
export const getRunEvents = (id: string, after: number, signal?: AbortSignal) =>
  get<EventPage>(
    `/api/v1/runs/${encodeURIComponent(id)}/events?after_sequence=${after}&limit=100`,
    signal,
  );
export const cancelRun = (id: string, body: VersionAction) =>
  post<RunSnapshot>(`/api/v1/runs/${encodeURIComponent(id)}/cancel`, body);
export const recoverRun = (
  id: string,
  body: VersionAction & { action: "reconcile" | "retry_safe_step" },
) => post<RunSnapshot>(`/api/v1/runs/${encodeURIComponent(id)}/recover`, body);
