import { test, expect, type Page } from "@playwright/test";
import { account, fixture, list, run, time } from "./fixtures";

const sessionId = "00000000-0000-4000-8000-000000000041";
const proposalId = "00000000-0000-4000-8000-000000000042";
const accepted = { run_id: "chat-run", manager_session_id: sessionId, status: "queued", version: 1, created_at: time };
const chatRun = {
  ...run, id: "chat-run", account_id: null, context_account_id: null, scope: "portfolio",
  manager_session_id: sessionId, outcome: "manager_response", artifacts: [],
};

async function chatFixture(page: Page) {
  await fixture(page);
  await page.route("**/api/v1/manager/chat/sessions?*", route => route.fulfill({ json: list([]) }));
  await page.route("**/api/v1/runs/chat-run", route => route.fulfill({ json: chatRun }));
  await page.route(`**/api/v1/manager-sessions/${sessionId}/messages?*`, route => route.fulfill({ json: list([
    { id: "operator-turn", session_id: sessionId, turn_index: 1, run_id: "chat-run", role: "operator", content: "Portfolio question", created_at: time },
    { id: "manager-turn", session_id: sessionId, turn_index: 2, run_id: "chat-run", role: "manager", content: "Synthetic portfolio priorities from backend evidence.", created_at: time },
  ]) }));
}

test("portfolio chat continues into account context and returns to the portfolio", async ({ page }) => {
  await chatFixture(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/manager/chat/runs", async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { ...accepted, run_id: `chat-run-${bodies.length}` } });
  });
  await page.route("**/api/v1/runs/chat-run-*", route => route.fulfill({ json: { ...chatRun, id: new URL(route.request().url()).pathname.split("/").pop() } }));
  await page.goto("/manager");
  await expect(page.getByText("Whole portfolio", { exact: true })).toBeVisible();
  await page.getByLabel("Message the manager").fill("Summarize portfolio priorities");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Synthetic portfolio priorities from backend evidence.")).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  await page.getByText("Find an account to discuss", { exact: true }).click();
  await page.getByRole("button", { name: "Discuss Synthetic Borrower" }).click();
  await page.getByLabel("Message the manager").fill("Explain the selected account risks");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toMatchObject({ context_account_id: null, manager_session_id: null, runtime_mode: "simulated" });
  expect(bodies[1]).toMatchObject({ context_account_id: "A001", manager_session_id: sessionId });
  await page.getByRole("button", { name: "Return to portfolio" }).click();
  await expect(page.getByText("Whole portfolio", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Synthetic portfolio priorities from backend evidence.")).toBeVisible();
  expect(bodies).toHaveLength(2);
});

test("lost chat acceptance recovers with a read after reload and stores no message content", async ({ page }) => {
  await chatFixture(page);
  let writes = 0;
  let requestKey = "";
  await page.route("**/api/v1/manager/chat/runs", async route => {
    writes += 1;
    requestKey = route.request().postDataJSON().idempotency_key;
    await route.abort();
  });
  await page.route("**/api/v1/manager/chat/requests/*", route => route.fulfill({ json: accepted }));
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Sensitive instruction stays in memory");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Recheck saved chat request" })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem("graceline.manager-chat.v1"));
  expect(saved).toContain(requestKey);
  expect(saved).not.toContain("Sensitive instruction");
  await page.reload();
  await expect(page.getByText("Synthetic portfolio priorities from backend evidence.")).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  expect(writes).toBe(1);
});

test("an unconfirmed chat requires explicit fresh choice and an in-memory retry preserves its payload", async ({ page }) => {
  await chatFixture(page);
  const bodies: unknown[] = [];
  await page.route("**/api/v1/manager/chat/runs", async route => {
    bodies.push(route.request().postDataJSON());
    await route.abort();
  });
  await page.route("**/api/v1/manager/chat/requests/*", route => route.fulfill({ status: 404, json: { detail: "No accepted request" } }));
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Compare the overdue accounts");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Retry same chat request" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual(bodies[0]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start a fresh chat request" })).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeDisabled();
  expect(bodies).toHaveLength(2);
  await page.getByRole("button", { name: "Start a fresh chat request" }).click();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  expect(bodies).toHaveLength(2);
});

test("task proposal stays advisory and explicit acceptance recovers the same child task", async ({ page }) => {
  await chatFixture(page);
  let childWrites = 0;
  let childBody: Record<string, unknown> = {};
  await page.route("**/api/v1/manager/chat/runs", route => route.fulfill({ status: 202, json: accepted }));
  await page.route("**/api/v1/runs/chat-run", route => route.fulfill({ json: {
    ...chatRun, artifacts: [{ id: proposalId, run_id: "chat-run", kind: "manager_task_proposal", text: "Consider a respectful reminder.", proposal: { account_id: "A001", task_type: "follow_up", instruction: "Prepare a respectful reminder draft" }, message_id: null, citation_ids: [], review_state: null, created_at: time }],
  } }));
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list(childWrites ? [{ ...run, id: "child-run" }] : []) }));
  await page.route("**/api/v1/accounts/A001/runs", async route => {
    childWrites += 1;
    childBody = route.request().postDataJSON();
    await route.abort();
  });
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Suggest a follow-up action");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare follow-up draft", exact: true })).toBeVisible();
  expect(childWrites).toBe(0);
  await page.getByRole("button", { name: "Prepare follow-up draft", exact: true }).click();
  await expect(page.getByText("Rechecking this action uses the same request key", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Open prepared task" })).toHaveAttribute("href", "/runs/child-run");
  expect(childWrites).toBe(1);
  expect(childBody).toEqual({ instruction: "Prepare a respectful reminder draft", task_type: "follow_up", runtime_mode: "simulated", manager_session_id: null, idempotency_key: proposalId });
});

test("Hermes unavailability remains visible and blocks chat submission", async ({ page }) => {
  await chatFixture(page);
  let writes = 0;
  await page.route("**/api/v1/manager/chat/runs", route => { writes += 1; return route.fulfill({ status: 202, json: accepted }); });
  await page.goto("/manager");
  await page.getByLabel("Chat runtime").selectOption("hermes");
  await expect(page.getByText("Selected chat runtime is unavailable.", { exact: false })).toBeVisible();
  await page.getByLabel("Message the manager").fill("Inspect portfolio priorities using Hermes");
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  expect(writes).toBe(0);
});

test("legacy account session links offer original task history before any global chat write", async ({ page }) => {
  await chatFixture(page);
  await page.goto("/manager?account=A001&session=legacy-session");
  await expect(page.getByRole("link", { name: "Open original account session" })).toHaveAttribute("href", "/manager/tasks?account=A001&session=legacy-session");
  await expect(page.getByLabel("Message the manager")).toBeDisabled();
  await page.getByRole("button", { name: "New portfolio chat" }).click();
  await expect(page).toHaveURL(/\/manager\?account=A001$/);
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
});

test("an explicit account entry replaces a completed saved context and changed context survives refresh", async ({ page }) => {
  await chatFixture(page);
  await page.route("**/api/v1/accounts?*", route => route.fulfill({ json: list([account, { ...account, id: "B002", borrower_name: "Borrower B", loan_reference: "LN-B002" }]) }));
  await page.addInitScript(() => {
    if (!localStorage.getItem("graceline.manager-chat.v1")) localStorage.setItem("graceline.manager-chat.v1", JSON.stringify({ sessionId: "older-session", runId: "chat-run", requestKey: null, mode: "simulated", contextAccountId: "B002" }));
  });
  await page.goto("/manager?account=A001");
  await expect(page.getByText("Account context · Synthetic Borrower", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  await expect(page.getByText("Synthetic portfolio priorities from backend evidence.")).toHaveCount(0);
  await page.getByText("Find an account to discuss", { exact: true }).click();
  await page.getByRole("button", { name: "Discuss Borrower B" }).click();
  await expect(page).toHaveURL(/account=B002/);
  await page.reload();
  await expect(page.getByText("Account context · Borrower B", { exact: true })).toBeVisible();
});

test("direct session lookup opens an older portfolio chat independently of the sidebar page", async ({ page }) => {
  await chatFixture(page);
  await page.route(`**/api/v1/manager/chat/sessions/${sessionId}`, route => route.fulfill({ json: {
    id: sessionId, account_id: null, context_account_id: "A001", title: "Older portfolio chat", origin: "operator", created_at: time, updated_at: time, last_run_id: "chat-run",
  } }));
  let body: Record<string, unknown> = {};
  await page.route("**/api/v1/manager/chat/runs", route => { body = route.request().postDataJSON(); return route.fulfill({ status: 202, json: { ...accepted, run_id: "chat-next" } }); });
  await page.route("**/api/v1/runs/chat-next", route => route.fulfill({ json: { ...chatRun, id: "chat-next" } }));
  await page.goto(`/manager?session=${sessionId}`);
  await expect(page.getByText("Synthetic portfolio priorities from backend evidence.")).toBeVisible();
  await page.getByLabel("Message the manager").fill("Continue this older discussion");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  expect(body).toMatchObject({ manager_session_id: sessionId, context_account_id: "A001" });
});

test("a historical proposal remains actionable through run evidence after a follow-up turn", async ({ page }) => {
  await chatFixture(page);
  let chatWrites = 0;
  let childWrites = 0;
  await page.route("**/api/v1/manager/chat/runs", route => {
    chatWrites += 1;
    return route.fulfill({ status: 202, json: { ...accepted, run_id: chatWrites === 1 ? "chat-run" : "chat-later" } });
  });
  await page.route("**/api/v1/runs/chat-run", route => route.fulfill({ json: {
    ...chatRun, artifacts: [{ id: proposalId, run_id: "chat-run", kind: "manager_task_proposal", text: "Consider a brief.", proposal: { account_id: "A001", task_type: "collector_brief", instruction: "Prepare the operator brief" }, message_id: null, citation_ids: [], review_state: null, created_at: time }],
  } }));
  await page.route("**/api/v1/runs/chat-later", route => route.fulfill({ json: { ...chatRun, id: "chat-later" } }));
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list(childWrites ? [{ ...run, id: "child-run" }] : []) }));
  await page.route("**/api/v1/accounts/A001/runs", route => {
    childWrites += 1;
    expect(route.request().postDataJSON()).toMatchObject({ idempotency_key: proposalId, task_type: "collector_brief", manager_session_id: null });
    return route.fulfill({ status: 202, json: { ...accepted, run_id: "child-run" } });
  });
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Suggest account work");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare collector brief", exact: true })).toBeVisible();
  await page.getByLabel("Message the manager").fill("Explain another portfolio risk");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  expect(childWrites).toBe(0);
  await page.getByRole("link", { name: "Inspect evidence", exact: true }).first().click();
  await expect(page).toHaveURL(/\/runs\/chat-run/);
  await page.getByRole("button", { name: "Prepare collector brief", exact: true }).dblclick();
  await expect(page.getByRole("link", { name: "Open prepared task" })).toHaveAttribute("href", "/runs/child-run");
  expect(childWrites).toBe(1);
});

test("an active saved run remains recoverable when opening a different account context", async ({ page }) => {
  await chatFixture(page);
  await page.addInitScript(() => localStorage.setItem("graceline.manager-chat.v1", JSON.stringify({ sessionId: "active-session", runId: "chat-run", requestKey: null, mode: "simulated", contextAccountId: "B002" })));
  let finished = false;
  await page.route("**/api/v1/runs/chat-run", route => route.fulfill({ json: { ...chatRun, status: finished ? "completed" : "running", version: finished ? 4 : 3, phase: finished ? "completed" : "manager_tools" } }));
  await page.goto("/manager?account=A001");
  await expect(page.getByText("Account context · B002", { exact: true })).toBeVisible();
  await expect(page.getByText("An earlier manager request is still unresolved.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeDisabled();
  finished = true;
  await expect(page.getByText("Account context · Synthetic Borrower", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
});
