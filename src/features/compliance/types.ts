export interface PolicyDecision {
  account_id: string;
  case_version: number;
  allowed: boolean;
  reason_codes: string[];
  policy_version: string | null;
  contact_state: "active" | "paused_human_review" | "paused_operator";
  evaluated_at: string;
}
export interface CaseActionRequest {
  expected_case_version: number;
  idempotency_key: string;
  note: string;
}
export interface CaseActionResult {
  account_id: string;
  case_version: number;
  contact_state: string;
  action_applied: boolean;
  reason_codes: string[];
  review_id: string | null;
}
export interface CurrentPolicy {
  id: string;
  version: string;
  timezone: string;
  contact_start_hour: number;
  contact_end_hour: number;
  coverage_until: string;
  maximum_daily_messages: number;
  mode: "demo_fixture";
}
