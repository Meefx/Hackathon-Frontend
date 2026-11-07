export interface IntegrationStatus {
  id: string;
  kind: "runtime" | "knowledge" | "mcp" | "guardrail" | "channel";
  implemented: boolean;
  configured: boolean;
  health: "healthy" | "unavailable" | "unknown";
  execution_mode: "simulated" | "hermes" | "in_process" | "unavailable";
  capabilities: string[];
  disabled_reason: string | null;
  checked_at: string | null;
}
