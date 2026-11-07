import { get } from "@/lib/http";
import type { AutomationStatus } from "./types";

export const getAutomationStatus = (signal?: AbortSignal) =>
  get<AutomationStatus>("/api/v1/collection-automation/status", signal);
