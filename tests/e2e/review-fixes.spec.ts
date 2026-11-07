import { test, expect } from "@playwright/test";
import { fixture, list, time } from "./fixtures";
test.beforeEach(async ({ page }) => fixture(page));

test("retrying an account read inside the manager form never starts a task", async ({
  page,
}) => {
  let reads = 0;
  let writes = 0;
  let failReads = true;
  await page.route("http://localhost:8000/api/v1/accounts?*", async (route) => {
    reads++;
    if (failReads)
      await route.fulfill({
        status: 503,
        json: { detail: "Account list unavailable" },
      });
    else
      await route.fulfill({
        json: list([
          {
            id: "A001",
            borrower_name: "Synthetic Borrower",
            loan_reference: "LN001",
          },
        ]),
      });
  });
  await page.route("**/accounts/A001/runs", async (route) => {
    writes++;
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
  await page.goto("/manager?account=A001");
  await expect(page.getByText("Account list unavailable")).toBeVisible();
  await page
    .getByLabel("Instruction")
    .fill("Valid instruction that must only submit when Start task is clicked");
  failReads = false;
  const submitted = page
    .waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/accounts/A001/runs"),
      { timeout: 1500 },
    )
    .then(
      () => true,
      () => false,
    );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByLabel("Select account")).toBeVisible();
  expect(await submitted).toBe(false);
  expect(writes).toBe(0);
  expect(reads).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/manager\?/);
});

test("keep paused replay reports a pause action and never claims resume", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/reviews/review1/resolve", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) await route.abort();
    else
      await route.fulfill({
        json: {
          review: {
            id: "review1",
            account_id: "A001",
            run_id: "run-1",
            reason: "hardship",
            status: "resolved",
            version: 2,
            created_at: time,
          },
          case: {
            account_id: "A001",
            case_version: 2,
            contact_state: "paused_operator",
            action_applied: true,
            reason_codes: [],
            review_id: null,
          },
        },
      });
  });
  await page.goto("/review");
  await page.getByRole("button", { name: "Open review" }).click();
  await page.getByLabel("Resolution note").fill("Keep human operator hold");
  await page
    .getByRole("button", { name: "Resolve review", exact: true })
    .click();
  await expect(page.getByLabel("Resolution decision")).toBeDisabled();
  await page.getByRole("button", { name: "Retry same resolution" }).click();
  await expect(
    page.getByText("pause resolution applied. Resume was not requested.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("resume applied", { exact: false })).toHaveCount(
    0,
  );
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[0]).toMatchObject({ decision: "keep_paused" });
});

test("artifact citation resolves sources on a later knowledge history page", async ({
  page,
}) => {
  const source = (citation: string) => ({
    document_id: "doc",
    document_version: "v1",
    snippet_id: citation,
    citation_id: citation,
    title: citation === "C1" ? "Cited source on page two" : "Other source",
    excerpt: "Approved evidence",
    content_hash: "hash",
    approved_at: time,
    source_uri: null,
  });
  const snapshot = (index: number) => ({
    id: `k-${index}`,
    run_id: "run-1",
    status: "ready",
    source_mode: "demo_fixture",
    required: true,
    retrieved_at: time,
    snapshot_hash: `hash-${index}`,
    sources: [source(index === 20 ? "C1" : `OTHER-${index}`)],
  });
  const offsets: number[] = [];
  await page.route("**/runs/run-1/knowledge?*", (route) => {
    const offset = Number(
      new URL(route.request().url()).searchParams.get("offset"),
    );
    offsets.push(offset);
    return route.fulfill({
      json: {
        items:
          offset === 0
            ? Array.from({ length: 20 }, (_, index) => snapshot(index))
            : [snapshot(20)],
        total: 21,
        limit: 20,
        offset,
      },
    });
  });
  await page.goto("/runs/run-1");
  await expect(page.getByText("Citation C1 is awaiting unloaded snapshot pages", { exact: false })).toBeVisible();
  expect([...new Set(offsets)]).toEqual([0]);
  await page.getByRole("button", { name: "Load next snapshots", exact: true }).click();
  await expect(page.getByText("Cited source on page two")).toBeVisible();
  expect(offsets).toContain(20);
  await expect(
    page.getByText("Citation C1 has no matching source", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "C1", exact: true }).click();
  await expect(page.locator("#evidence-run-1-C1")).toBeInViewport();
});

test("polling applies versioned specialist progress and heartbeat", async ({
  page,
}) => {
  const { run } = await import("./fixtures");
  let progressed = false;
  await page.route("**/api/v1/runs/run-1", (route) =>
    route.fulfill({
      json: {
        ...run,
        status: "running",
        outcome: null,
        version: progressed ? 4 : 3,
        heartbeat_at: progressed ? "2026-11-07T03:01:00Z" : time,
        steps: [
          {
            ...run.steps[0],
            summary: progressed
              ? "QA completed with persisted evidence"
              : "Specialist pending",
          },
        ],
      },
    }),
  );
  await page.goto("/runs/run-1");
  await expect(page.getByText("Specialist pending")).toBeVisible();
  progressed = true;
  await expect(
    page.getByText("QA completed with persisted evidence"),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/07 Nov 2026,? 10:01:00/)).toBeVisible();
  await expect(page.getByText("Specialist pending")).toHaveCount(0);
});
