export interface AutomationStatus {
  enabled: boolean;
  daily_start_time: string;
  timezone: string;
  runtime_mode: "simulated" | "hermes";
  business_date: string;
  last_scan_at: string | null;
  counts: {
    queued: number;
    running: number;
    sent: number;
    deferred: number;
    needs_attention: number;
  };
  attention_items: {
    id: string;
    account_id: string;
    run_id: string | null;
    reason_codes: string[];
    updated_at: string;
  }[];
}
