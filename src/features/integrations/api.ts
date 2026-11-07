import { get } from "@/lib/http";
import type { IntegrationStatus } from "./types";
export const getIntegrations = (signal?: AbortSignal) =>
  get<{ items: IntegrationStatus[] }>("/api/v1/integrations", signal);
