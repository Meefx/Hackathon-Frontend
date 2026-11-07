import { test, expect } from "@playwright/test";
import { fixture, run, list, time } from "./fixtures";
test.beforeEach(async ({ page }) => fixture(page));
test("lost accepted response is recovered by request key after refresh without resubmitting", async ({
  page,
}) => {
  let writes = 0;
  let submittedKey = "";
  await page.route("**/accounts/A001/runs", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      submittedKey = route.request().postDataJSON().idempotency_key;
      await route.abort();
    } else await route.fulfill({ json: list([run]) });
  });
  await page.goto("/manager/tasks");
  await page.getByLabel("Select account").selectOption("A001");
  await page.getByLabel("Instruction").fill("Prepare a follow up");
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(
    page.getByText("The request may have been accepted.", { exact: false }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    localStorage.getItem("collectflow.pending-run.v1"),
  );
  expect(saved).toContain(submittedKey);
  expect(saved).not.toContain("Prepare a follow up");
  await page.reload();
  await expect(page).toHaveURL(/\/runs\/run-1/);
  expect(writes).toBe(1);
});
test("run refresh cannot replace a newer snapshot with a stale version", async ({
  page,
}) => {
  let stale = false;
  await page.route("**/api/v1/runs/run-1", (route) =>
    route.fulfill({
      json: {
        ...run,
        version: stale ? 2 : 9,
        phase: stale ? "stale_phase" : "verified_newer",
      },
    }),
  );
  await page.goto("/runs/run-1");
  await expect(page.getByText("verified_newer")).toBeVisible();
  stale = true;
  await page.getByRole("button", { name: "Refresh run" }).click();
  await expect(page.getByText("verified_newer")).toBeVisible();
  await expect(page.getByText("stale_phase")).toHaveCount(0);
});
test("run cancellation remains requested until worker confirmation and retries retain exact payload", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/api/v1/runs/run-1", (route) =>
    route.fulfill({
      json: {
        ...run,
        status: "running",
        outcome: null,
        allowed_actions: ["cancel"],
        cancellation_requested_at: time,
      },
    }),
  );
  await page.route("**/runs/run-1/cancel", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) await route.abort();
    else await route.fulfill({ json: { ...run, status: "running" } });
  });
  await page.goto("/runs/run-1");
  await expect(
    page.getByText("Worker cancellation is not confirmed.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Request cancellation" }).click();
  await page.getByRole("button", { name: "Retry same action" }).click();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
});
test("network failure preserves confirmed run state and labels updates delayed", async ({
  page,
}) => {
  let disconnected = false;
  await page.route("**/api/v1/runs/run-1", async (route) => {
    if (disconnected) await route.abort();
    else
      await route.fulfill({
        json: { ...run, status: "running", outcome: null },
      });
  });
  await page.goto("/runs/run-1");
  await expect(
    page.getByText("running", { exact: true }).first(),
  ).toBeVisible();
  disconnected = true;
  await expect(
    page.getByText("Status update delayed.", { exact: false }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByText("running", { exact: true }).first(),
  ).toBeVisible();
});
test("takeover outcome remains visible after policy refresh", async ({
  page,
}) => {
  await page.route("**/accounts/A001/takeover", (route) =>
    route.fulfill({
      json: {
        account_id: "A001",
        case_version: 2,
        contact_state: "paused_operator",
        action_applied: true,
        reason_codes: [],
        review_id: "review1",
      },
    }),
  );
  await page.goto("/accounts/A001");
  await page.getByLabel("Case action note").fill("Operator handling this case");
  await page.getByRole("button", { name: "Take over case" }).click();
  await expect(
    page.getByText("Action applied. Case remains paused_operator."),
  ).toBeVisible();
  await expect(page.getByLabel("Case action note")).toHaveValue("");
  await expect(
    page.getByText("Action applied. Case remains paused_operator."),
  ).toBeVisible();
});

test("confirmed run lets operator return to manager for a new session turn", async ({
  page,
}) => {
  await page.goto("/manager/tasks");
  await page.getByLabel("Select account").selectOption("A001");
  await page.getByLabel("Instruction").fill("First task");
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page.getByText("draft_created")).toBeVisible();
  await page.getByRole("link", { name: "Continue with manager" }).click();
  await expect(page).toHaveURL(/\/manager\/tasks\?/);
  await expect(page.getByLabel("Instruction")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Follow up", exact: true }),
  ).toBeVisible();
});

test("late recovery read cannot navigate away after operator changes page", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "collectflow.pending-run.v1",
      JSON.stringify({
        accountId: "A001",
        requestKey: "request-1",
        sessionId: null,
        runId: null,
      }),
    ),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let began!: () => void;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  await page.route("**/accounts/A001/runs?*", async (route) => {
    began();
    await gate;
    await route.fulfill({ json: list([run]) });
  });
  await page.goto("/manager/tasks");
  await started;
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Agent registry" }),
  ).toBeVisible();
  release();
  const hijacked = await page.waitForURL(/\/runs\//, { timeout: 1500 }).then(
    () => true,
    () => false,
  );
  expect(hijacked).toBe(false);
  await expect(page).toHaveURL(/\/agents$/);
  await expect(
    page.getByRole("heading", { name: "Agent registry" }),
  ).toBeVisible();
});
