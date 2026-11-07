import { expect, test } from "@playwright/test";
import { fixture, list, run, time } from "./fixtures";

test("dashboard links open review and contextual discussion stays in place", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/v1/collection-automation/status", route => route.fulfill({ json: {
    enabled: true, daily_start_time: "09:00", timezone: "Asia/Jakarta", runtime_mode: "simulated",
    business_date: "2026-11-07", last_scan_at: time,
    counts: { queued: 1, running: 0, sent: 2, deferred: 0, needs_attention: 1 }, attention_items: [],
  } }));
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/accounts/A001/runs", async route => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: { run_id: `run-${bodies.length}`, manager_session_id: "discussion-1", status: "queued", version: 1, created_at: time } });
  });
  await page.route(/\/api\/v1\/runs\/run-\d+$/, route => route.fulfill({ json: { ...run, manager_session_id: "discussion-1", outcome: "brief_created", artifacts: [] } }));
  await page.route("**/api/v1/manager-sessions/discussion-1/messages?*", route => route.fulfill({ json: list([
    { id: "turn1", session_id: "discussion-1", turn_index: 1, role: "manager", content: "The hardship case remains paused pending your decision.", created_at: time, run_id: "run-1" },
  ]) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Daily collection" })).toBeVisible();
  await page.getByRole("link", { name: /Review hardship/ }).click();
  await expect(page).toHaveURL(/\/review\?review=review1/);
  await expect(page.getByRole("heading", { name: "Review context" })).toBeVisible();
  await page.getByLabel("Question for manager").fill("What should I consider for this hardship case?");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect(page.getByText("The hardship case remains paused pending your decision.")).toBeVisible();
  expect(bodies[0]).toMatchObject({ task_type: "collector_brief", review_id: "review1", manager_session_id: null, runtime_mode: "simulated" });
  await expect(page).toHaveURL(/\/review\?review=review1/);
  await expect(page.getByText("Simulated manager response")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resolve review" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("The hardship case remains paused pending your decision.")).toBeVisible();
  expect(bodies).toHaveLength(1);
  const journal = await page.evaluate(() => localStorage.getItem("collectflow.review-discussion.v1.A001.review1"));
  expect(journal).not.toContain("What should I consider");
  await page.getByLabel("Question for manager").fill("Which evidence supports that advice?");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ review_id: "review1", task_type: "collector_brief", manager_session_id: "discussion-1" });
  expect(bodies[1].idempotency_key).not.toEqual(bodies[0].idempotency_key);
});

test("discussion retries the exact request after an uncertain acceptance", async ({ page }) => {
  await fixture(page);
  const requests: unknown[] = [];
  await page.route("**/api/v1/accounts/A001/runs", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, json: { detail: { message: "Temporarily unavailable" } } });
  });
  await page.goto("/review?review=review1");
  await page.getByLabel("Question for manager").fill("Explain the review");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect(page.getByRole("button", { name: "Retry same discussion request" })).toBeVisible();
  await expect(page.getByLabel("Question for manager")).toBeDisabled();
  await page.getByRole("button", { name: "Retry same discussion request" }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
});

test("scheduled evidence starts a new operator-owned manager session", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/v1/runs/run-1", route => route.fulfill({ json: { ...run, origin: "scheduled", manager_session_id: "scheduler-owned" } }));
  await page.goto("/runs/run-1");
  await expect(page.getByRole("link", { name: "Continue with manager" })).toHaveAttribute("href", "/manager?account=A001");
});

test("lost discussion acceptance recovers by saved key after reload without resubmitting", async ({ page }) => {
  await fixture(page);
  let requestKey = "";
  let submissions = 0;
  await page.route("**/api/v1/accounts/A001/runs", async route => {
    requestKey = route.request().postDataJSON().idempotency_key;
    submissions += 1;
    await route.fulfill({ status: 503, json: { detail: { message: "Lost acceptance response" } } });
  });
  let recoveredKey = "";
  await page.route("**/api/v1/accounts/A001/runs?*", async route => {
    recoveredKey = new URL(route.request().url()).searchParams.get("request_key") || "";
    await route.fulfill({ json: list([{ ...run, manager_session_id: "recovered-discussion" }]) });
  });
  await page.goto("/review?review=review1");
  await page.getByLabel("Question for manager").fill("Review this case context");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect(page.getByRole("button", { name: "Retry same discussion request" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Discussion completed")).toBeVisible();
  await expect(page.getByLabel("Question for manager")).toBeEnabled();
  expect(recoveredKey).toEqual(requestKey);
  expect(submissions).toBe(1);
});

test("scheduled manager history is readable and requires a new operator session", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/v1/accounts/A001/manager-sessions?*", route => route.fulfill({ json: list([
    { id: "scheduler-owned", account_id: "A001", title: "Daily scheduled follow up", origin: "scheduled", created_at: time, updated_at: time, last_run_id: "run-1" },
  ]) }));
  await page.goto("/manager/tasks?account=A001");
  await expect(page.getByRole("button", { name: "Daily scheduled follow up" })).toBeDisabled();
  await page.getByText("Inspect scheduled session history").click();
  await expect(page.getByText("Choose New session to discuss this account as an operator.")).toBeVisible();
});

test("dashboard exposes stale worker scans and actionable runless attention", async ({ page }) => {
  await fixture(page);
  await page.clock.setFixedTime(new Date("2026-11-07T04:30:00Z"));
  await page.route("**/api/v1/collection-automation/status", route => route.fulfill({ json: {
    enabled: true, daily_start_time: "09:00", timezone: "Asia/Jakarta", runtime_mode: "simulated",
    business_date: "2026-11-07", last_scan_at: time,
    counts: { queued: 0, running: 0, sent: 0, deferred: 0, needs_attention: 1 },
    attention_items: [{ id: "schedule-1", account_id: "A001", run_id: null, reason_codes: ["data_stale"], updated_at: time }],
  } }));
  await page.goto("/");
  await expect(page.getByText("Worker scan is overdue. Check that the collection worker is running.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open account", exact: true })).toHaveAttribute("href", "/accounts/A001");
});

test("empty recovery lookup allows an explicit fresh discussion without automatic writes", async ({ page }) => {
  await fixture(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/accounts/A001/runs", async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) {
      await route.fulfill({ status: 503, json: { detail: { message: "Request did not arrive" } } });
    } else {
      await route.fulfill({ status: 202, json: { run_id: "run-1", manager_session_id: "session-1", status: "queued", version: 1, created_at: time } });
    }
  });
  await page.route("**/api/v1/accounts/A001/runs?*", route => route.fulfill({ json: list([]) }));
  await page.goto("/review?review=review1");
  await page.getByLabel("Question for manager").fill("Original discussion question");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect(page.getByRole("button", { name: "Retry same discussion request" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Start a fresh discussion" })).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByRole("button", { name: "Start a fresh discussion" }).click();
  await expect(page.getByLabel("Question for manager")).toBeEnabled();
  expect(bodies).toHaveLength(1);
  await page.getByLabel("Question for manager").fill("New discussion question");
  await page.getByRole("button", { name: "Ask about case" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ manager_session_id: null, review_id: "review1", task_type: "collector_brief" });
  expect(bodies[1].idempotency_key).not.toEqual(bodies[0].idempotency_key);
});
