export interface AgentDefinition {
  id: string;
  role:
    "manager" | "collection" | "knowledge" | "qa" | "improvement" | "copilot";
  name: string;
  description: string;
  configured: boolean;
  available: boolean;
  runtime_mode: "simulated" | "hermes" | "unavailable";
  capabilities: string[];
  unavailable_reason: string | null;
  checked_at: string | null;
}
