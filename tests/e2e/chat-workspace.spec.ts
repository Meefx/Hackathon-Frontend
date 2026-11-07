import { test, expect, type Page } from "@playwright/test";
import { fixture, list, run, time } from "./fixtures";

const sessionId = "00000000-0000-4000-8000-000000000051";
const proposalId = "00000000-0000-4000-8000-000000000052";
const accepted = { run_id: "workspace-chat", manager_session_id: sessionId, status: "queued", version: 1, created_at: time };
const chatRun = { ...run, id: "workspace-chat", account_id: null, scope: "portfolio", manager_session_id: sessionId, artifacts: [], outcome: "manager_replied" };

async function workspaceFixture(page: Page) {
  await fixture(page);
  await page.route("**/api/v1/manager/chat/sessions?*", route => route.fulfill({ json: list([]) }));
  await page.route("**/api/v1/runs/workspace-chat", route => route.fulfill({ json: chatRun }));
  await page.route(`**/api/v1/manager-sessions/${sessionId}/messages?*`, route => route.fulfill({ json: list([
    { id: "question", session_id: sessionId, turn_index: 1, role: "operator", run_id: "workspace-chat", content: "Prepare a follow-up", created_at: time },
    { id: "answer", session_id: sessionId, turn_index: 1, role: "manager", run_id: "workspace-chat", content: "I have identified the next account task.", created_at: time },
  ]) }));
}

async function configureHermes(page: Page) {
  await page.route("**/api/v1/agents", route => route.fulfill({ json: { items: [{
    id: "manager", role: "manager", name: "Manager", description: "Portfolio coordination",
    configured: true, available: true, runtime_mode: "hermes", capabilities: [], unavailable_reason: null, checked_at: time,
  }] } }));
  await page.route("**/api/v1/integrations", route => route.fulfill({ json: { items: ["hermes", "simulated_runtime", "simulated_chat"].map(id => ({
    id, kind: id === "simulated_chat" ? "channel" : "runtime", implemented: true, configured: true,
    health: "healthy", execution_mode: id === "hermes" ? "hermes" : "simulated", capabilities: [], disabled_reason: null, checked_at: time,
  })) } }));
}

test("landing opens one conversation sidebar and moves operational navigation to settings", async ({ page }) => {
  await workspaceFixture(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Collection manager" })).toBeVisible();
  await expect(page.getByRole("complementary")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "New portfolio chat" })).toBeVisible();
  await expect(page.getByLabel("Chat runtime")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Accounts", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Portfolio overview", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Collections overview" })).toBeVisible();
});

test("configured manager runtime is used without asking for a technical choice in chat", async ({ page }) => {
  await workspaceFixture(page);
  await configureHermes(page);
  let submitted: Record<string, unknown> = {};
  await page.route("**/api/v1/manager/chat/runs", route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: accepted });
  });
  await page.goto("/");
  await page.getByLabel("Message the manager").fill("Prioritize eligible accounts and prepare next steps");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("I have identified the next account task.")).toBeVisible();
  expect(submitted).toMatchObject({ runtime_mode: "hermes", context_account_id: null });
});

test("runtime preference is configured in settings and survives a reload", async ({ page }) => {
  await workspaceFixture(page);
  await configureHermes(page);
  let submitted: Record<string, unknown> = {};
  await page.route("**/api/v1/manager/chat/runs", route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: accepted });
  });
  await page.goto("/settings");
  await page.getByLabel("Chat runtime").selectOption("simulated");
  await page.getByRole("link", { name: "Back to chat", exact: true }).click();
  await expect(page).toHaveURL(/\/manager$/);
  await page.reload();
  await page.getByLabel("Message the manager").fill("Summarize priorities using the selected demo runtime");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("I have identified the next account task.")).toBeVisible();
  expect(submitted.runtime_mode).toBe("simulated");
});

const proposal = {
  id: proposalId, run_id: "workspace-chat", kind: "manager_task_proposal", text: "Prepare a concise collector brief.",
  proposal: { account_id: "A001", task_type: "collector_brief", instruction: "Summarize the account for its collector" },
  message_id: null, citation_ids: [], review_state: null, created_at: time,
};
const preparedRun = {
  ...run, id: "workspace-task", outcome: "brief_created", artifacts: [{
    id: "brief", run_id: "workspace-task", kind: "collector_brief", text: "Eligible account. Prioritize a respectful reminder.",
    message_id: null, citation_ids: [], review_state: null, created_at: time,
  }],
};

async function proposeTask(page: Page) {
  await workspaceFixture(page);
  await page.route("**/api/v1/manager/chat/runs", route => route.fulfill({ status: 202, json: accepted }));
  await page.route("**/api/v1/runs/workspace-chat", route => route.fulfill({ json: { ...chatRun, artifacts: [proposal] } }));
  await page.route("**/api/v1/runs/workspace-task", route => route.fulfill({ json: preparedRun }));
}

async function askForTask(page: Page) {
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Prepare the next account task");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare collector brief", exact: true })).toBeVisible();
}

test("prepared task results stay in the conversation and reload recovers with reads", async ({ page }) => {
  await proposeTask(page);
  let writes = 0;
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list(writes ? [preparedRun] : []) }));
  await page.route("**/api/v1/accounts/A001/runs", route => {
    writes += 1;
    expect(route.request().postDataJSON()).toEqual({
      instruction: "Summarize the account for its collector", task_type: "collector_brief",
      runtime_mode: "simulated", manager_session_id: null, idempotency_key: proposalId,
    });
    return route.fulfill({ status: 202, json: { ...accepted, run_id: "workspace-task" } });
  });
  await askForTask(page);
  await page.getByRole("button", { name: "Prepare collector brief", exact: true }).dblclick();
  await expect(page.getByRole("region", { name: "Prepared account task" })).toContainText("Eligible account. Prioritize a respectful reminder.");
  await expect(page).toHaveURL(/\/manager$/);
  expect(writes).toBe(1);
  await page.reload();
  await expect(page.getByRole("region", { name: "Prepared account task" })).toContainText("Eligible account. Prioritize a respectful reminder.");
  expect(writes).toBe(1);
});

test("earlier task proposals stay actionable after another chat turn", async ({ page }) => {
  await proposeTask(page);
  let chatWrites = 0;
  let taskWrites = 0;
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list(taskWrites ? [preparedRun] : []) }));
  await page.route("**/api/v1/accounts/A001/runs", route => {
    taskWrites += 1;
    return route.fulfill({ status: 202, json: { ...accepted, run_id: "workspace-task" } });
  });
  await page.route("**/api/v1/manager/chat/runs", route => {
    chatWrites += 1;
    return route.fulfill({ status: 202, json: { ...accepted, run_id: chatWrites === 1 ? "workspace-chat" : "later-chat" } });
  });
  await page.route("**/api/v1/runs/later-chat", route => route.fulfill({ json: { ...chatRun, id: "later-chat" } }));
  await page.route(`**/api/v1/manager-sessions/${sessionId}/messages?*`, route => route.fulfill({ json: list([
    { id: "earlier", session_id: sessionId, turn_index: 1, role: "manager", run_id: "workspace-chat", content: "The earlier task is ready for your choice.", created_at: time },
    ...(chatWrites > 1 ? [{ id: "later", session_id: sessionId, turn_index: 2, role: "manager", run_id: "later-chat", content: "Here is another portfolio observation.", created_at: time }] : []),
  ]) }));
  await askForTask(page);
  await page.getByLabel("Message the manager").fill("Explain another portfolio risk");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Here is another portfolio observation.")).toBeVisible();
  await page.getByRole("button", { name: "Prepare collector brief", exact: true }).click();
  await expect(page.getByRole("region", { name: "Prepared account task" })).toContainText("Eligible account. Prioritize a respectful reminder.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Prepared account task" })).toContainText("Eligible account. Prioritize a respectful reminder.");
  expect(taskWrites).toBe(1);
});

const draftMessage = {
  id: "workspace-message", account_id: "A001", run_id: "workspace-task", channel: "simulated_chat",
  direction: "outbound", text: "Selamat pagi, silakan periksa tagihan Anda.", status: "draft",
  version: 1, citation_ids: ["C1"], created_at: time,
};

async function draftFixture(page: Page) {
  await proposeTask(page);
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list([{ ...preparedRun, id: "workspace-task" }]) }));
  await page.route("**/api/v1/runs/workspace-task", route => route.fulfill({ json: {
    ...preparedRun, outcome: "draft_created", artifacts: [{
      id: "draft", run_id: "workspace-task", kind: "draft", text: draftMessage.text,
      message_id: draftMessage.id, citation_ids: ["C1"], review_state: null, created_at: time,
    }],
  } }));
  await page.route("**/api/v1/accounts/A001/messages?*", route => route.fulfill({ json: list([draftMessage]) }));
}

test("reviewed draft is approved through the backend while staying in chat", async ({ page }) => {
  await draftFixture(page);
  let writes = 0;
  await page.route("**/api/v1/messages/workspace-message/simulate-dispatch", route => {
    writes += 1;
    expect(route.request().postDataJSON()).toMatchObject({ expected_message_version: 1 });
    return route.fulfill({ json: { message_id: draftMessage.id, status: "simulated_sent", reason_codes: [], audit_event_id: "audit-sent" } });
  });
  await askForTaskWithExistingChild(page);
  const draft = page.getByRole("region", { name: "Draft review" });
  await expect(draft).toContainText(draftMessage.text);
  expect(writes).toBe(0);
  await draft.getByRole("button", { name: "Approve simulated send", exact: true }).dblclick();
  await expect(draft.getByRole("status")).toContainText("simulated_sent");
  await expect(page).toHaveURL(/\/manager$/);
  expect(writes).toBe(1);
});

async function askForTaskWithExistingChild(page: Page) {
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Review the prepared reminder");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("region", { name: "Prepared account task" })).toBeVisible();
}

test("paused case disables inline approval and displays the backend reason", async ({ page }) => {
  await draftFixture(page);
  await page.route("**/api/v1/accounts/A001/contact-policy", route => route.fulfill({ json: {
    account_id: "A001", case_version: 2, allowed: false, reason_codes: ["case_paused"],
    policy_version: "demo-v1", contact_state: "paused_human_review", evaluated_at: time,
  } }));
  await askForTaskWithExistingChild(page);
  const draft = page.getByRole("region", { name: "Draft review" });
  await expect(draft).toContainText("Case contact is paused");
  await expect(draft.getByRole("button", { name: "Approve simulated send", exact: true })).toBeDisabled();
});

test("an uncertain simulated send preserves its exact request through reload", async ({ page }) => {
  await draftFixture(page);
  const bodies: unknown[] = [];
  await page.route("**/api/v1/messages/workspace-message/simulate-dispatch", async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) return route.abort();
    return route.fulfill({ json: { message_id: draftMessage.id, status: "simulated_sent", reason_codes: [], audit_event_id: "audit-retry" } });
  });
  await askForTaskWithExistingChild(page);
  await page.getByRole("button", { name: "Approve simulated send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry same simulated send", exact: true })).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain(draftMessage.text);
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry same simulated send", exact: true })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "Retry same simulated send", exact: true }).click();
  await expect(page.getByRole("region", { name: "Draft review" }).getByRole("status")).toContainText("simulated_sent");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
});

test("older draft pages are loaded explicitly before approval", async ({ page }) => {
  await draftFixture(page);
  const offsets: number[] = [];
  await page.route("**/api/v1/accounts/A001/messages?*", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    return route.fulfill({ json: { items: offset ? [draftMessage] : [], total: 21, limit: 20, offset } });
  });
  await askForTaskWithExistingChild(page);
  await page.getByRole("button", { name: "Load earlier draft messages", exact: true }).click();
  await expect(page.getByRole("region", { name: "Draft review" })).toContainText(draftMessage.text);
  expect([...new Set(offsets)]).toEqual([0, 20]);
  await expect(page.getByRole("button", { name: "Approve simulated send", exact: true })).toBeEnabled();
});

test("backend dispatch rejection is reported without showing a sent outcome", async ({ page }) => {
  await draftFixture(page);
  await page.route("**/api/v1/messages/workspace-message/simulate-dispatch", route => route.fulfill({ json: {
    message_id: draftMessage.id, status: "blocked", reason_codes: ["approval_expired"], audit_event_id: "audit-blocked",
  } }));
  await askForTaskWithExistingChild(page);
  await page.getByRole("button", { name: "Approve simulated send", exact: true }).click();
  const status = page.getByRole("region", { name: "Draft review" }).getByRole("status");
  await expect(status).toContainText("blocked");
  await expect(status).toContainText("Approval has expired");
  await expect(status).not.toContainText("simulated_sent");
});

test("changing settings preserves an unconfirmed chat request and its original runtime", async ({ page }) => {
  await workspaceFixture(page);
  await configureHermes(page);
  let writes = 0;
  await page.route("**/api/v1/manager/chat/runs", route => {
    writes += 1;
    return route.abort();
  });
  await page.route("**/api/v1/manager/chat/requests/*", route => route.fulfill({ status: 404, json: { detail: "No acceptance confirmed" } }));
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Analyze this portfolio");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Recheck saved chat request" })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Chat runtime").selectOption("simulated");
  await page.getByRole("link", { name: "Back to chat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start a fresh chat request" })).toBeVisible();
  await expect(page.getByLabel("Message the manager")).toBeDisabled();
  const journal = await page.evaluate(() => JSON.parse(localStorage.getItem("graceline.manager-chat.v1") || "null"));
  expect(journal.mode).toBe("hermes");
  expect(writes).toBe(1);
});

test("reload confirms an already accepted simulated send without another write", async ({ page }) => {
  await draftFixture(page);
  let writes = 0;
  await page.route("**/api/v1/accounts/A001/messages?*", route => route.fulfill({ json: list([
    { ...draftMessage, status: writes ? "simulated_sent" : "draft", version: writes ? 2 : 1 },
  ]) }));
  await page.route("**/api/v1/messages/workspace-message/simulate-dispatch", route => {
    writes += 1;
    return route.abort();
  });
  await askForTaskWithExistingChild(page);
  await page.getByRole("button", { name: "Approve simulated send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry same simulated send", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Draft review" }).getByRole("status")).toContainText("simulated_sent");
  await expect(page.getByRole("button", { name: "Retry same simulated send", exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("graceline.draft-dispatch.v1.workspace-message"))).toBeNull();
  expect(writes).toBe(1);
});

test("missing policy fails closed and can be retried without dispatching", async ({ page }) => {
  await draftFixture(page);
  let unavailable = true;
  let writes = 0;
  await page.route("**/api/v1/accounts/A001/contact-policy", route => unavailable
    ? route.fulfill({ status: 503, json: { detail: "Contact policy unavailable" } })
    : route.fulfill({ json: { account_id: "A001", case_version: 1, allowed: true, reason_codes: [], policy_version: "demo-v1", contact_state: "active", evaluated_at: time } }));
  await page.route("**/api/v1/messages/workspace-message/simulate-dispatch", route => {
    writes += 1;
    return route.abort();
  });
  await askForTaskWithExistingChild(page);
  await expect(page.getByRole("button", { name: "Retry draft lookup", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve simulated send", exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Retry draft lookup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve simulated send", exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test("channel-specific drafts keep their channel and offer the existing controls", async ({ page }) => {
  await draftFixture(page);
  await page.route("**/api/v1/accounts/A001/messages?*", route => route.fulfill({ json: list([{ ...draftMessage, channel: "whatsapp" }]) }));
  await askForTaskWithExistingChild(page);
  await expect(page.getByRole("region", { name: "Draft review" })).toContainText("whatsapp");
  await expect(page.getByRole("button", { name: "Approve simulated send", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open channel-specific draft controls" })).toHaveAttribute("href", "/accounts/A001#message-workspace-message");
});

test("mobile history starts collapsed and the composer stays within the viewport", async ({ page }) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New portfolio chat" })).toBeEnabled();
  const history = page.locator("details").filter({ has: page.locator("summary", { hasText: "Conversations" }) });
  await expect(history).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Message the manager")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await history.locator("summary").click();
  await expect(history).toHaveAttribute("open", "");
});

test("a long manager response scrolls independently of the composer", async ({ page }) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/manager/chat/runs", route => route.fulfill({ status: 202, json: accepted }));
  await page.route(`**/api/v1/manager-sessions/${sessionId}/messages?*`, route => route.fulfill({ json: list([
    { id: "long", session_id: sessionId, turn_index: 1, role: "manager", run_id: "workspace-chat", content: "A portfolio observation.\n".repeat(100), created_at: time },
  ]) }));
  await page.goto("/");
  await page.getByLabel("Message the manager").fill("Explain all portfolio priorities");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  await expect(page.getByLabel("Message the manager")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test("selecting another saved chat updates its direct link and survives reload", async ({ page }) => {
  await workspaceFixture(page);
  const secondId = "00000000-0000-4000-8000-000000000061";
  const sessions = [
    { id: sessionId, account_id: null, context_account_id: null, title: "Original conversation", origin: "operator", created_at: time, updated_at: time, last_run_id: "workspace-chat" },
    { id: secondId, account_id: null, context_account_id: null, title: "Second conversation", origin: "operator", created_at: time, updated_at: time, last_run_id: "second-chat" },
  ];
  await page.route("**/api/v1/manager/chat/sessions?*", route => route.fulfill({ json: list(sessions) }));
  await page.route("**/api/v1/manager/chat/sessions/*", route => route.fulfill({ json: sessions.find(item => route.request().url().endsWith(item.id)) }));
  await page.route("**/api/v1/runs/second-chat", route => route.fulfill({ json: { ...chatRun, id: "second-chat", manager_session_id: secondId } }));
  await page.route(`**/api/v1/manager-sessions/${secondId}/messages?*`, route => route.fulfill({ json: list([
    { id: "second-message", session_id: secondId, turn_index: 1, role: "manager", run_id: "second-chat", content: "Second saved conversation content.", created_at: time },
  ]) }));
  await page.goto(`/manager?session=${sessionId}`);
  await expect(page.getByLabel("Message the manager")).toBeEnabled();
  await page.getByRole("button", { name: "Second conversation", exact: false }).click();
  await expect(page.getByText("Second saved conversation content.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`session=${secondId}`));
  await page.reload();
  await expect(page.getByText("Second saved conversation content.")).toBeVisible();
});

test("portal is directly accessible from chat and an account can be discussed with the manager", async ({ page }) => {
  await workspaceFixture(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Portal", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Collections overview" })).toBeVisible();
  const accountRow = page.getByRole("row").filter({ hasText: "Synthetic Borrower" });
  await expect(accountRow).toContainText("1–30 days");
  await expect(accountRow).toContainText("LN-001");
  await page.getByRole("button", { name: "View Synthetic Borrower's account" }).click();
  await page.getByRole("link", { name: "Discuss with manager", exact: true }).click();
  await expect(page).toHaveURL(/\/manager\?account=A001$/);
  await expect(page.getByText("Account context · Synthetic Borrower", { exact: true })).toBeVisible();
});
