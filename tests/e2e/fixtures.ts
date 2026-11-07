import { type Page } from "@playwright/test";
export const time = "2026-11-07T03:00:00Z";
export const account = {
  id: "A001",
  borrower_name: "Synthetic Borrower",
  loan_reference: "LN-001",
  outstanding_amount: 1200000,
  due_date: "2026-11-01",
  assigned_to: "Collector",
  days_past_due: 6,
  status: "early",
};
export const run = {
  id: "run-1",
  account_id: "A001",
  manager_session_id: "session-1",
  status: "completed",
  outcome: "draft_created",
  requested_runtime_mode: "simulated",
  actual_runtime_mode: "simulated",
  phase: "completed",
  steps: [
    {
      id: "s1",
      sequence: 1,
      role: "knowledge",
      status: "completed",
      summary: "Approved context retrieved",
      evidence_origin: "backend_verified",
    },
  ],
  artifacts: [
    {
      id: "art1",
      run_id: "run-1",
      kind: "draft",
      text: "Silakan periksa tagihan Anda.",
      message_id: "m1",
      citation_ids: ["C1"],
      created_at: time,
    },
  ],
  reason_codes: [],
  version: 3,
  session_turn_index: 1,
  latest_event_seq: 1,
  created_at: time,
  allowed_actions: [],
};
export function list(items: unknown[]) {
  return { items, total: items.length, limit: 20, offset: 0 };
}
export async function fixture(page: Page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};
    if (path.endsWith("/dashboard"))
      body = {
        total_accounts: 31,
        total_outstanding: 37200000,
        overdue_accounts: 31,
        overdue_amount: 37200000,
        buckets: [{ status: "early", count: 31, outstanding_amount: 37200000 }],
      };
    else if (path === "/api/v1/whatsapp/messages")
      body = { items: [], total: 0, limit: 10, offset: 0 };
    else if (path === "/api/v1/accounts")
      body = {
        ...list([account]),
        total: 31,
        limit: 10,
        offset: Number(url.searchParams.get("offset") || 0),
      };
    else if (path === "/api/v1/accounts/A001") body = account;
    else if (path === "/api/v1/agents")
      body = {
        items: [
          "manager",
          "collection",
          "knowledge",
          "qa",
          "improvement",
          "copilot",
        ].map((role) => ({
          id: role,
          role,
          name: role,
          description: `${role} specialist`,
          configured: true,
          available: role !== "qa",
          runtime_mode: role === "qa" ? "unavailable" : "simulated",
          capabilities: ["demo"],
          unavailable_reason: role === "qa" ? "Runtime disconnected" : null,
          checked_at: time,
        })),
      };
    else if (path === "/api/v1/integrations")
      body = {
        items: [
          "Hermes",
          "MCP",
          "Knowledge",
          "Guardrail",
          "simulated_chat",
          "WhatsApp",
          "Email",
          "Phone",
        ].map((id) => ({
          id,
          kind: ["WhatsApp", "Email", "Phone", "simulated_chat"].includes(id)
            ? "channel"
            : "runtime",
          implemented: id === "simulated_chat",
          configured: id === "simulated_chat",
          health: id === "simulated_chat" ? "healthy" : "unavailable",
          execution_mode: id === "simulated_chat" ? "simulated" : "unavailable",
          capabilities: [],
          disabled_reason: "Provider not implemented",
          checked_at: time,
        })),
      };
    else if (
      path === "/api/v1/accounts/A001/runs" &&
      route.request().method() === "POST"
    )
      body = {
        run_id: "run-1",
        manager_session_id: "session-1",
        status: "queued",
        version: 1,
        created_at: time,
      };
    else if (path.endsWith("/runs")) body = list([run]);
    else if (path === "/api/v1/runs/run-1") body = run;
    else if (path.endsWith("/events"))
      body = {
        items: [
          {
            sequence: 1,
            run_id: "run-1",
            type: "completed",
            safe_summary: "Draft verified",
            evidence_origin: "backend_verified",
            created_at: time,
          },
        ],
        next_sequence: 1,
        has_more: false,
      };
    else if (path.endsWith("/knowledge"))
      body = list([
        {
          id: "k1",
          run_id: "run-1",
          status: "ready",
          source_mode: "demo_fixture",
          required: true,
          retrieved_at: time,
          snapshot_hash: "snapshot-hash",
          sources: [
            {
              document_id: "doc1",
              document_version: "1",
              snippet_id: "snippet1",
              citation_id: "C1",
              title: "Approved SOP",
              excerpt: "Use respectful language.",
              content_hash: "hash1",
              approved_at: time,
              source_uri: "javascript:alert(1)",
            },
          ],
        },
      ]);
    else if (path.endsWith("/contact-policy"))
      body = {
        account_id: "A001",
        case_version: 1,
        allowed: true,
        reason_codes: [],
        policy_version: "demo-v1",
        contact_state: "active",
        evaluated_at: time,
      };
    else if (path.endsWith("/manager-sessions"))
      body = list([
        {
          id: "session-1",
          account_id: "A001",
          title: "Follow up",
          created_at: time,
          updated_at: time,
          last_run_id: "run-1",
        },
      ]);
    else if (path === "/api/v1/reviews")
      body = list([
        {
          id: "review1",
          account_id: "A001",
          run_id: "run-1",
          reason: "hardship",
          status: "open",
          version: 1,
          created_at: time,
        },
      ]);
    else if (path === "/api/v1/reviews/review1")
      body = {
        id: "review1",
        account_id: "A001",
        run_id: "run-1",
        reason: "hardship",
        status: "open",
        version: 1,
        created_at: time,
      };
    else if (path.endsWith("/messages") || path.endsWith("/audit"))
      body = list([]);
    else {
      await route.fulfill({
        status: 404,
        json: { detail: { code: "not_found", message: "Not found" } },
      });
      return;
    }
    await route.fulfill({
      status: route.request().method() === "POST" ? 202 : 200,
      json: body,
    });
  });
}
