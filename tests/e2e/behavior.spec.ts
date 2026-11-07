import { test, expect } from "@playwright/test";
import { fixture, run, list, time, account } from "./fixtures";
test.beforeEach(async ({ page }) => fixture(page));
test("account filtering resets pagination and dialog Escape restores focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("31", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Showing 11–20 of 31 accounts")).toBeVisible();
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/accounts?") &&
      r.url().includes("search=Jordan") &&
      r.url().includes("offset=0"),
  );
  await page.getByRole("searchbox").fill("Jordan");
  await request;
  const button = page.getByRole("button", {
    name: "View Synthetic Borrower's account",
  });
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(button).toBeFocused();
  await expect(page.getByText("31", { exact: true }).first()).toBeVisible();
});
test("mobile navigation stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manager");
  await expect(
    page.getByRole("heading", { name: "Collection manager" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Integrations", exact: true }),
  ).toBeVisible();
});
test("account missing is an error state with retry", async ({ page }) => {
  await page.goto("/accounts/missing");
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByLabel("Borrower message")).toHaveCount(0);
});
for (const status of [
  "queued",
  "running",
  "blocked",
  "failed",
  "interrupted",
  "cancelled",
] as const) {
  test(`run displays backend ${status} without inferring business completion`, async ({
    page,
  }) => {
    await page.route("**/api/v1/runs/run-1", (route) =>
      route.fulfill({
        json: {
          ...run,
          status,
          phase: status,
          outcome: null,
          reason_codes:
            status === "blocked" ? ["knowledge_reference_invalid"] : [],
          allowed_actions: status === "interrupted" ? ["reconcile"] : [],
        },
      }),
    );
    await page.goto("/runs/run-1");
    await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("draft_created", { exact: true })).toHaveCount(
      0,
    );
    if (status === "interrupted")
      await expect(
        page.getByRole("button", { name: "Reconcile run" }),
      ).toBeVisible();
    if (status === "blocked")
      await expect(
        page.getByText("Knowledge reference is invalid or revoked", {
          exact: false,
        }),
      ).toBeVisible();
  });
}
for (const status of ["no_results", "unavailable", "error"] as const) {
  test(`knowledge snapshot ${status} keeps portfolio and source mode readable`, async ({
    page,
  }) => {
    await page.route("**/runs/run-1/knowledge?*", (route) =>
      route.fulfill({
        json: list([
          {
            id: "k1",
            run_id: "run-1",
            status,
            source_mode: "demo_fixture",
            required: true,
            retrieved_at: time,
            snapshot_hash: "hash",
            sources: [],
            reason_code:
              status === "no_results"
                ? "no_approved_context"
                : "knowledge_unavailable",
          },
        ]),
      }),
    );
    await page.goto("/runs/run-1");
    await expect(page.getByText(status, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Knowledge integration status" }),
    ).toBeVisible();
    await expect(
      page.getByText("Citation C1 has no matching source", { exact: false }),
    ).toBeVisible();
  });
}
test("dispatch lost response retries exact message version and key", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  let sent = false;
  await page.route("**/accounts/A001/messages?*", (route) =>
    route.fulfill({
      json: list([
        {
          id: "m1",
          account_id: "A001",
          run_id: "run-1",
          channel: "simulated_chat",
          direction: "outbound",
          text: "Draft from approved context",
          status: sent ? "simulated_sent" : "draft",
          version: sent ? 2 : 1,
          citation_ids: ["C1"],
          created_at: time,
        },
      ]),
    }),
  );
  await page.route("**/messages/m1/simulate-dispatch", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) await route.abort();
    else {
      sent = true;
      await route.fulfill({
        json: {
          message_id: "m1",
          status: "simulated_sent",
          reason_codes: [],
          audit_event_id: "audit1",
        },
      });
    }
  });
  await page.goto("/accounts/A001");
  await page
    .getByRole("button", { name: "Simulate dispatch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry same conversation action" })
    .click();
  await expect(page.getByText("simulated_sent", { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await page.reload();
  expect(bodies).toHaveLength(2);
});
test("paused contact disables dispatch while inbound remains available", async ({
  page,
}) => {
  await page.route("**/accounts/A001/contact-policy", (route) =>
    route.fulfill({
      json: {
        account_id: "A001",
        case_version: 4,
        allowed: false,
        reason_codes: ["case_paused"],
        policy_version: "v1",
        contact_state: "paused_human_review",
        evaluated_at: time,
      },
    }),
  );
  await page.route("**/accounts/A001/messages?*", (route) =>
    route.fulfill({
      json: list([
        {
          id: "m1",
          account_id: "A001",
          channel: "simulated_chat",
          direction: "outbound",
          text: "Draft",
          status: "draft",
          version: 1,
          citation_ids: [],
          created_at: time,
        },
      ]),
    }),
  );
  await page.goto("/accounts/A001");
  await expect(
    page.getByRole("button", { name: "Simulate dispatch", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Borrower message").fill("Saya butuh bantuan");
  await expect(
    page.getByRole("button", { name: "Receive simulated inbound" }),
  ).toBeEnabled();
});
test("stale review version refreshes context and keeps resume outcome separate", async ({
  page,
}) => {
  let conflict = true;
  let resolved = false;
  await page.route("**/reviews/review1", (route) =>
    route.fulfill({
      json: {
        id: "review1",
        account_id: "A001",
        run_id: "run-1",
        reason: "hardship",
        status: resolved ? "resolved" : "open",
        version: conflict ? 1 : 2,
        created_at: time,
      },
    }),
  );
  await page.route("**/reviews/review1/resolve", async (route) => {
    if (conflict) {
      conflict = false;
      await route.fulfill({
        status: 409,
        json: {
          detail: {
            code: "version_conflict",
            message: "Review changed; reload context",
          },
        },
      });
    } else {
      resolved = true;
      await route.fulfill({
        json: {
          review: {
            id: "review1",
            account_id: "A001",
            run_id: "run-1",
            reason: "hardship",
            status: "resolved",
            version: 3,
            created_at: time,
          },
          case: {
            account_id: "A001",
            case_version: 3,
            contact_state: "paused_human_review",
            action_applied: false,
            reason_codes: ["case_paused"],
            review_id: null,
          },
        },
      });
    }
  });
  await page.goto("/review");
  await page.getByRole("button", { name: "Open review" }).click();
  await page.getByLabel("Resolution decision").selectOption("request_resume");
  await page
    .getByLabel("Resolution note")
    .fill("Verified hardship with operator");
  await page
    .getByRole("button", { name: "Resolve review", exact: true })
    .click();
  await expect(page.getByText("Review changed; reload context")).toBeVisible();
  await expect(page.getByText("Version 2", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Resolve review", exact: true })
    .click();
  await expect(
    page.getByText(
      "Review resolved. Case paused_human_review; resume not applied.",
      { exact: false },
    ),
  ).toBeVisible();
});
for (const task of ["collector_brief", "improvement_review"] as const) {
  test(`manager submits ${task} with selected session and no duplicate writes`, async ({
    page,
  }) => {
    let writes = 0;
    let submitted: Record<string, unknown> = {};
    await page.route("**/accounts/A001/runs", async (route) => {
      writes++;
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 202,
        json: {
          run_id: "run-1",
          manager_session_id: "session-1",
          status: "queued",
          version: 1,
          created_at: time,
        },
      });
    });
    await page.goto("/manager");
    await page.getByLabel("Select account").selectOption("A001");
    await page.getByRole("button", { name: "Follow up", exact: true }).click();
    await page.getByLabel("Task type").selectOption(task);
    await page.getByLabel("Instruction").fill("Create the requested artifact");
    await page
      .getByRole("button", { name: "Start task", exact: true })
      .dblclick();
    await expect(page).toHaveURL(/\/runs\/run-1/);
    expect(writes).toBe(1);
    expect(submitted.task_type).toBe(task);
    expect(submitted.manager_session_id).toBe("session-1");
  });
}
test("account navigation cannot apply old account result", async ({ page }) => {
  await page.route("http://localhost:8000/api/v1/accounts/A002", (route) =>
    route.fulfill({
      json: { ...account, id: "A002", borrower_name: "Second Borrower" },
    }),
  );
  await page.goto("/accounts/A001");
  await expect(
    page.getByRole("heading", { name: "Synthetic Borrower", exact: true }),
  ).toBeVisible();
  await page.goto("/accounts/A002");
  await expect(
    page.getByRole("heading", { name: "Second Borrower", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Synthetic Borrower", exact: true }),
  ).toHaveCount(0);
});

test("knowledge history pages preserve snapshot identity and citation evidence", async ({
  page,
}) => {
  await page.route("**/runs/run-1/knowledge?*", (route) => {
    const offset = Number(
      new URL(route.request().url()).searchParams.get("offset"),
    );
    return route.fulfill({
      json: {
        ...list([
          {
            id: `k${offset}`,
            run_id: "run-1",
            status: "ready",
            source_mode: "demo_fixture",
            required: true,
            retrieved_at: time,
            snapshot_hash: `snapshot-${offset}`,
            sources: [],
          },
        ]),
        total: 21,
        limit: 20,
        offset,
      },
    });
  });
  await page.goto("/runs/run-1");
  await expect(
    page.getByText("Snapshot snapshot-0", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Snapshot snapshot-20", { exact: true }),
  ).toBeVisible();
});
