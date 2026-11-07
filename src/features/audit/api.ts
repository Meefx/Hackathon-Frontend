import { get, type Page } from "@/lib/http";
import type { AuditEvent } from "./types";
export const getAudit = (account: string, offset = 0, signal?: AbortSignal) =>
  get<Page<AuditEvent>>(
    `/api/v1/accounts/${encodeURIComponent(account)}/audit?offset=${offset}&limit=20`,
    signal,
  );
