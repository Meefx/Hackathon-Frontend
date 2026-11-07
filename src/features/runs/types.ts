export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "interrupted";
export type TaskType = "follow_up" | "collector_brief" | "improvement_review";
export interface StartRunRequest {
  instruction: string;
  task_type: TaskType;
  runtime_mode: "simulated" | "hermes";
  idempotency_key: string;
  manager_session_id: string | null;
  demo_scenario?: "reminder" | "hardship" | "dispute" | "human_request";
}
export interface RunAccepted {
  run_id: string;
  manager_session_id: string;
  status: "queued";
  version: number;
  created_at: string;
}
export interface RunStep {
  id: string;
  sequence: number;
  role: string;
  status: string;
  summary: string;
  evidence_origin: string;
  started_at: string | null;
  finished_at: string | null;
}
export interface RunArtifact {
  id: string;
  run_id: string;
  kind: "draft" | "qa_report" | "collector_brief" | "improvement_proposal";
  text: string;
  message_id: string | null;
  citation_ids: string[];
  review_state: "pending" | "approved" | "rejected" | null;
  created_at: string;
}
export interface RunSnapshot {
  id: string;
  account_id: string;
  manager_session_id: string;
  status: RunStatus;
  outcome: string | null;
  requested_runtime_mode: string;
  actual_runtime_mode: string | null;
  phase: string;
  steps: RunStep[];
  artifacts: RunArtifact[];
  reason_codes: string[];
  version: number;
  session_turn_index: number;
  latest_event_seq: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  cancellation_requested_at: string | null;
  allowed_actions: string[];
}
export interface RunEvent {
  sequence: number;
  run_id: string;
  type: string;
  safe_summary: string;
  evidence_origin: string;
  created_at: string;
}
export interface EventPage {
  items: RunEvent[];
  next_sequence: number;
  has_more: boolean;
}
export interface VersionAction {
  expected_version: number;
  idempotency_key: string;
}
