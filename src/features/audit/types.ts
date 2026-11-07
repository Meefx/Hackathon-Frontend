export interface AuditEvent {
  id: string;
  account_id: string;
  run_id: string | null;
  action: string;
  actor_kind: string;
  outcome: string;
  reason_codes: string[];
  correlation_id: string;
  created_at: string;
  previous_hash: string | null;
  event_hash: string;
}
