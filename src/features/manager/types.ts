export interface ManagerSession {
  origin?: "operator" | "scheduled";
  id: string;
  account_id: string | null;
  context_account_id?: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  last_run_id: string | null;
}
export interface ManagerTurn {
  id: string;
  session_id: string;
  turn_index: number;
  run_id: string | null;
  role: "operator" | "manager" | "scheduler";
  content: string;
  created_at: string;
}
export interface RecoveryJournal {
  accountId: string;
  requestKey: string;
  sessionId: string | null;
  runId: string | null;
}

export interface ChatRunRequest {
  instruction: string;
  runtime_mode: "simulated" | "hermes";
  idempotency_key: string;
  manager_session_id: string | null;
  context_account_id: string | null;
}
export interface ChatJournal {
  sessionId: string | null;
  runId: string | null;
  requestKey: string | null;
  mode: "simulated" | "hermes";
  contextAccountId: string | null;
}
