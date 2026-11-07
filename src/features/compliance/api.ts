import { get, post } from "@/lib/http";
import type {
  PolicyDecision,
  CaseActionRequest,
  CaseActionResult,
  CurrentPolicy,
} from "./types";
export const getPolicy = (account: string, signal?: AbortSignal) =>
  get<PolicyDecision>(
    `/api/v1/accounts/${encodeURIComponent(account)}/contact-policy`,
    signal,
  );
export const getCurrentPolicy = (signal?: AbortSignal) =>
  get<CurrentPolicy>("/api/v1/policies/current", signal);
export const caseAction = (
  account: string,
  action: "takeover" | "resume",
  body: CaseActionRequest,
) =>
  post<CaseActionResult>(
    `/api/v1/accounts/${encodeURIComponent(account)}/${action}`,
    body,
  );
