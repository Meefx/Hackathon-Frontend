import { test, expect, type Page } from "@playwright/test";
import { fixture, list, run, time } from "./fixtures";

const liveRun = {
  ...run, account_id: null, requested_runtime_mode: "hermes", actual_runtime_mode: "hermes",
  status: "running", phase: "runtime", steps: [], artifacts: [], outcome: null, version: 1,
};
function event(sequence: number, type: string, agentId = "manager", extra = {}) {
  return { sequence, type, agent_id: agentId, parent_agent_id: agentId === "manager" ? null : "manager", tool_name: null, tool_call_id: null, status: type.endsWith("complete") ? "completed" : "running", created_at: time, ...extra };
}
function activity(events: unknown[], nextSequence: number, extra = {}) {
  return { source: "hermes", status: "available", events, next_sequence: nextSequence, has_more: false, truncated: false, reason_code: null, ...extra };
}
async function liveFixture(page: Page) {
  await fixture(page);
  await page.route("**/api/v1/runs/run-1", route => route.fulfill({ json: liveRun }));
}

test("activity map follows real parallel subagents, cursor pages and selected evidence", async ({ page }) => {
  await liveFixture(page);
  let completed = false;
  const cursors: number[] = [];
  const events = [
    event(0, "run.started"), event(1, "subagent.start", "worker-a"),
    event(2, "tool.started", "manager", { tool_name: "portfolio_read", tool_call_id: "tool-1" }),
    event(3, "subagent.start", "worker-b"),
  ];
  await page.route("**/api/v1/runs/run-1/activity?*", route => {
    const cursor = Number(new URL(route.request().url()).searchParams.get("after_sequence"));
    cursors.push(cursor);
    if (cursor < 2) return route.fulfill({ json: activity(events.slice(0, 3), 2, { has_more: true }) });
    const remaining = [...events.slice(3), ...(completed ? [event(4, "subagent.complete", "worker-a"), event(5, "tool.completed", "manager", { tool_name: "portfolio_read", tool_call_id: "tool-1", status: "completed" })] : [])].filter(item => item.sequence > cursor);
    return route.fulfill({ json: activity(remaining, completed ? 5 : 3) });
  });
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByRole("button", { name: "Subagent worker-a · Working", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Subagent worker-b · Working", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Manager · Working", exact: true })).toContainText("portfolio_read");
  await map.getByRole("button", { name: "Subagent worker-b · Working", exact: true }).click();
  await expect(map.getByLabel("Selected agent details")).toContainText("worker-b");
  await expect(map.getByLabel("Selected agent details")).toContainText("subagent.start");
  await expect(map.getByLabel("Selected agent details")).toContainText("10:00:00 GMT+7");
  completed = true;
  await page.getByRole("button", { name: "Refresh run", exact: true }).click();
  await expect(map.getByRole("button", { name: "Subagent worker-a · Completed", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Subagent worker-b · Working", exact: true })).toHaveCount(1);
  await expect(map.getByRole("button", { name: "Manager · Working", exact: true })).not.toContainText("portfolio_read");
  expect(cursors).toContain(-1);
  expect(cursors).toContain(2);
  expect(cursors).toContain(3);
  await page.screenshot({ path: "/Users/IDSP36075/.codex/visualizations/2026/11/07/01a1b532-ec92-7eb0-babd-94725f4020f7/agent-activity-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/Users/IDSP36075/.codex/visualizations/2026/11/07/01a1b532-ec92-7eb0-babd-94725f4020f7/agent-activity-mobile.png", fullPage: true });
});

test("terminal run reads final telemetry and preserves unverified child evidence during outage", async ({ page }) => {
  await liveFixture(page);
  let terminal = false;
  await page.route("**/api/v1/runs/run-1", route => route.fulfill({ json: { ...liveRun, status: terminal ? "completed" : "running", phase: terminal ? "completed" : "runtime", version: terminal ? 2 : 1 } }));
  await page.route("**/api/v1/runs/run-1/activity?*", route => route.fulfill({ json: terminal
    ? activity([], 1, { status: "unavailable", reason_code: "runtime_activity_expired" })
    : activity([event(0, "run.started"), event(1, "subagent.start", "worker-a")], 1) }));
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByRole("button", { name: "Subagent worker-a · Working", exact: true })).toBeVisible();
  terminal = true;
  await page.getByRole("button", { name: "Refresh run", exact: true }).click();
  await expect(map.getByRole("button", { name: "Manager · Completed", exact: true })).toBeVisible();
  await expect(map.getByText("Activity unverified", { exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Subagent worker-a · Unknown", exact: true })).toBeVisible();
  await map.getByRole("button", { name: "Subagent worker-a · Unknown", exact: true }).click();
  await expect(map.getByLabel("Selected agent details")).toContainText("subagent.start");
  await expect(map.getByText("No longer confirmed active", { exact: false })).toBeVisible();
  await expect(page.getByText("Status update delayed", { exact: false })).toHaveCount(0);
});

test("old backend activity is unavailable while simulated map uses only persisted steps on mobile", async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByText("Simulated evidence", { exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Knowledge step · Completed", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: /Collection step|QA step/ })).toHaveCount(0);
  await expect(map.getByText("Step timing is simulated", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/Users/IDSP36075/.codex/visualizations/2026/11/07/01a1b532-ec92-7eb0-babd-94725f4020f7/agent-activity-simulated-mobile.png", fullPage: true });
});

test("missing live telemetry keeps the real run status without invented subagents", async ({ page }) => {
  await liveFixture(page);
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByText("Activity unverified", { exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Manager · Working", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: /Subagent/ })).toHaveCount(0);
  await expect(map.getByText("No confirmed subagent activity", { exact: false })).toBeVisible();
});

test("manager conversation includes activity map for its accepted run", async ({ page }) => {
  await liveFixture(page);
  const sessionId = "00000000-0000-4000-8000-000000000081";
  await page.route("**/api/v1/manager/chat/sessions?*", route => route.fulfill({ json: list([]) }));
  await page.route(`**/api/v1/manager-sessions/${sessionId}/messages?*`, route => route.fulfill({ json: list([]) }));
  await page.route("**/api/v1/manager/chat/runs", route => route.fulfill({ status: 202, json: { run_id: "run-1", manager_session_id: sessionId, status: "queued", version: 1, created_at: time } }));
  await page.route("**/api/v1/runs/run-1/activity?*", route => route.fulfill({ json: activity([event(0, "run.started"), event(1, "subagent.start", "worker-a")], 1) }));
  await page.goto("/manager");
  await page.getByLabel("Message the manager").fill("Review the portfolio");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("region", { name: "Agent activity map" }).getByRole("button", { name: "Subagent worker-a · Working", exact: true })).toBeVisible();
});


test("truncated history leaves active children unverified and blocked parent explicit", async ({ page }) => {
  await liveFixture(page);
  await page.route("**/api/v1/runs/run-1", route => route.fulfill({ json: { ...liveRun, status: "blocked", phase: "blocked", version: 2 } }));
  await page.route("**/api/v1/runs/run-1/activity?*", route => route.fulfill({ json: activity([event(50, "subagent.start", "worker-a")], 50, { truncated: true }) }));
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByRole("button", { name: "Manager · Blocked", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Subagent worker-a · Unknown", exact: true })).toBeVisible();
  await expect(map.getByText("Runtime history is truncated", { exact: false })).toBeVisible();
});

test("truncated active history cannot confirm a child is still working", async ({ page }) => {
  await liveFixture(page);
  await page.route("**/api/v1/runs/run-1/activity?*", route => route.fulfill({ json: activity([event(50, "subagent.start", "worker-a")], 50, { truncated: true }) }));
  await page.goto("/runs/run-1");
  await expect(page.getByRole("region", { name: "Agent activity map" }).getByRole("button", { name: "Subagent worker-a · Unknown", exact: true })).toBeVisible();
});

test("terminal polling reads final child evidence and tool call IDs distinguish concurrent calls", async ({ page }) => {
  await liveFixture(page);
  let terminal = false;
  await page.route("**/api/v1/runs/run-1", route => route.fulfill({ json: { ...liveRun, status: terminal ? "completed" : "running", version: terminal ? 2 : 1 } }));
  await page.route("**/api/v1/runs/run-1/activity?*", route => {
    const cursor = Number(new URL(route.request().url()).searchParams.get("after_sequence"));
    const events = [event(0, "subagent.start", "worker-a"),
      event(1, "tool.started", "manager", { tool_name: "portfolio_read", tool_call_id: "one" }),
      event(2, "tool.started", "manager", { tool_name: "portfolio_read", tool_call_id: "two" }),
      event(3, "tool.completed", "manager", { tool_name: "portfolio_read", tool_call_id: "one", status: "completed" }),
      ...(terminal ? [event(4, "subagent.complete", "worker-a"), event(5, "run.completed", "manager", { status: "completed" })] : [])];
    return route.fulfill({ json: activity(events.filter(item => item.sequence > cursor), terminal ? 5 : 3) });
  });
  await page.goto("/runs/run-1");
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByRole("button", { name: "Manager · Working", exact: true })).toContainText("portfolio_read");
  terminal = true;
  await expect(map.getByRole("button", { name: "Manager · Completed", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(map.getByRole("button", { name: "Subagent worker-a · Completed", exact: true })).toBeVisible();
});

test("a delayed activity response from a previous run cannot populate the next run", async ({ page }) => {
  await liveFixture(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("**/api/v1/runs/run-1/activity?*", async route => {
    started = true;
    await pending;
    await route.fulfill({ json: activity([event(0, "subagent.start", "old-worker")], 0) }).catch(() => {});
  });
  await page.route("**/api/v1/runs/run-2", route => route.fulfill({ json: { ...liveRun, id: "run-2" } }));
  await page.route("**/api/v1/runs/run-2/activity?*", route => route.fulfill({ json: activity([event(0, "subagent.start", "new-worker")], 0) }));
  await page.goto("/runs/run-1");
  await expect.poll(() => started).toBe(true);
  await page.goto("/runs/run-2");
  release();
  const map = page.getByRole("region", { name: "Agent activity map" });
  await expect(map.getByRole("button", { name: "Subagent new-worker · Working", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: /old-worker/ })).toHaveCount(0);
});
