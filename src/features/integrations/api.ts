import { get, post } from "@/lib/http";
import type { GmailCollectionDemo, GmailCollectionDemoStatus, IntegrationStatus } from "./types";
export const getIntegrations = (signal?: AbortSignal) =>
  get<{ items: IntegrationStatus[] }>("/api/v1/integrations", signal);

const gmailDemoPath = "/api/v1/integrations/gmail/collection-demo";
export const getGmailCollectionDemoStatus = (signal?: AbortSignal) =>
  get<GmailCollectionDemoStatus>(gmailDemoPath, signal);
export const getGmailCollectionDemo = (id: string, signal?: AbortSignal) =>
  get<GmailCollectionDemo>(`${gmailDemoPath}/${encodeURIComponent(id)}`, signal);
export const startGmailCollectionDemo = (idempotencyKey: string) =>
  post<GmailCollectionDemo>(gmailDemoPath, { idempotency_key: idempotencyKey });
