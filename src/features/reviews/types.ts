import type { CaseActionResult } from "@/features/compliance/types";
export interface ReviewItem {
  id: string;
  account_id: string;
  run_id: string | null;
  reason: "hardship" | "dispute" | "human_request" | "operator_takeover";
  status: "open" | "resolved";
  version: number;
  created_at: string;
  resolved_at: string | null;
}
export interface ReviewResolution {
  decision: "keep_paused" | "request_resume";
  note: string;
  expected_version: number;
  idempotency_key: string;
}
export interface ReviewResolutionResult {
  review: ReviewItem;
  case: CaseActionResult;
}
