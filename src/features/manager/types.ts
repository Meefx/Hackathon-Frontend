export interface ManagerSession {
  id: string;
  account_id: string;
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
  role: "operator" | "manager";
  content: string;
  created_at: string;
}
export interface RecoveryJournal {
  accountId: string;
  requestKey: string;
  sessionId: string | null;
  runId: string | null;
}
