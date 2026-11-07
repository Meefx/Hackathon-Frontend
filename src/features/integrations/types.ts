export interface IntegrationStatus {
  id: string;
  kind: "runtime" | "knowledge" | "mcp" | "guardrail" | "channel";
  implemented: boolean;
  configured: boolean;
  health: "healthy" | "unavailable" | "unknown";
  execution_mode: "simulated" | "hermes" | "in_process" | "sandbox" | "unavailable";
  capabilities: string[];
  disabled_reason: string | null;
  checked_at: string | null;
}

export interface GmailCollectionDemo {
  id: string;
  account_id: string;
  run_id: string;
  status: "queued" | "running" | "submitted" | "blocked" | "failed" | "delivery_unknown";
  reason_codes: string[];
  recipient_masked: string;
  message_id: string | null;
  provider_message_id: string | null;
  created_at: string;
  updated_at: string;
  runtime_mode: "simulated";
}

export interface GmailCollectionDemoStatus {
  configured: boolean;
  recipient_masked: string | null;
  latest: GmailCollectionDemo | null;
}
