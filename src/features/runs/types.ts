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
  review_id?: string;
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
  kind: "draft" | "qa_report" | "collector_brief" | "improvement_proposal" | "manager_response" | "manager_task_proposal";
  proposal?: {
    account_id: string;
    task_type: TaskType;
    instruction: string;
  } | null;
  text: string;
  message_id: string | null;
  citation_ids: string[];
  review_state: "pending" | "approved" | "rejected" | null;
  created_at: string;
}
export interface RunSnapshot {
  origin?: "operator" | "scheduled";
  id: string;
  account_id: string | null;
  context_account_id?: string | null;
  scope?: "portfolio" | "account";
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

export interface RuntimeActivityEvent {
  sequence: number;
  type: "subagent.start" | "subagent.complete" | "tool.started" | "tool.completed" | "run.started" | "run.completed" | "run.failed" | "run.cancelled";
  agent_id: string;
  parent_agent_id: string | null;
  tool_name: string | null;
  tool_call_id?: string | null;
  status: "running" | "completed" | "failed" | "cancelled" | null;
  created_at: string | null;
}
export interface RuntimeActivityPage {
  source: "hermes" | "simulated" | "backend";
  status: "available" | "unavailable" | "not_started";
  events: RuntimeActivityEvent[];
  next_sequence: number;
  has_more: boolean;
  truncated: boolean;
  reason_code: string | null;
}
export interface RunActivityState {
  source: RuntimeActivityPage["source"];
  status: RuntimeActivityPage["status"];
  events: RuntimeActivityEvent[];
  truncated: boolean;
  reasonCode: string | null;
  error: string;
  loading: boolean;
}
