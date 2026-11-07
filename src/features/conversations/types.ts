export interface Message {
  id: string;
  account_id: string;
  run_id: string | null;
  channel: "simulated_chat" | "whatsapp" | "email" | "phone";
  direction: "inbound" | "outbound";
  text: string;
  status: "received" | "draft" | "simulated_sent" | "blocked" | "submitted" | "sent" | "delivered" | "read" | "failed" | "delivery_unknown";
  version: number;
  citation_ids: string[];
  created_at: string;
}
export interface InboundRequest {
  text: string;
  idempotency_key: string;
  demo_scenario?: "reminder" | "hardship" | "dispute" | "human_request";
}
export interface DispatchResult {
  message_id: string;
  status: "simulated_sent" | "blocked" | "unavailable" | "submitted" | "sent" | "delivered" | "read" | "failed" | "delivery_unknown";
  reason_codes: string[];
  audit_event_id: string;
}

export interface WhatsAppConnection {
  account_id: string;
  configured: boolean;
  linked: boolean;
  session_status: string;
  recipient_masked: string | null;
  mode: "sandbox";
  reason_codes: string[];
}
