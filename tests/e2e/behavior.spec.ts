import { test, expect } from "@playwright/test";
import { fixture, run, list, time, account } from "./fixtures";
test.beforeEach(async ({ page }) => fixture(page));
test("account filtering resets pagination and dialog Escape restores focus", async ({
  page,
}) => {
  await page.goto("/overview");
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
  await page.getByRole("complementary").getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Integrations", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Chat runtime")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
    await page.goto("/manager/tasks");
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

test("knowledge history loads bounded pages and resolves a citation after snapshot 20", async ({ page }) => {
  const offsets: number[] = [];
  await page.route("**/runs/run-1/knowledge?*", (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    return route.fulfill({ json: {
      items: Array.from({ length: offset === 0 ? 20 : 1 }, (_, index) => ({
        id: `k${offset + index}`, run_id: "run-1", status: "ready",
        source_mode: "knowledge_module", required: true, retrieved_at: time,
        snapshot_hash: `snapshot-${offset + index}`,
        sources: offset === 20 ? [{ document_id: "doc-late", document_version: "2",
          snippet_id: "late", citation_id: "C1", title: "Later approved SOP",
          excerpt: "Respect the borrower.", content_hash: "late-hash", approved_at: time,
          effective_from: null, effective_until: null, source_uri: "synthetic://approved/sop" }] : [],
      })), total: 21, limit: 20, offset,
    } });
  });
  await page.goto("/runs/run-1");
  await expect(page.getByText("Snapshot snapshot-0", { exact: true })).toBeVisible();
  await expect(page.getByText("Citation C1 is awaiting unloaded snapshot pages", { exact: false })).toBeVisible();
  expect([...new Set(offsets)]).toEqual([0]);
  await expect(page.getByText("has no matching source", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Load next snapshots", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Later approved SOP" })).toBeVisible();
  await expect(page.getByText("awaiting unloaded snapshot pages", { exact: false })).toHaveCount(0);
  await page.getByRole("link", { name: "C1", exact: true }).click();
  await expect(page.locator("#evidence-run-1-C1")).toBeInViewport();
  expect([...new Set(offsets)]).toEqual([0, 20]);
});

test("knowledge module preserves nullable provenance, critical context and actual retrieval profile on reload", async ({ page }) => {
  await page.route("**/runs/run-1/knowledge?*", (route) => route.fulfill({ json: list([{
    id: "km-1", run_id: "run-1", status: "ready", source_mode: "knowledge_module",
    required: true, retrieved_at: time, snapshot_hash: "immutable-km-hash", snapshot_hash_version: 2,
    reason_code: null,
    sources: [{ document_id: "doc-km", document_version: "3", snippet_id: "chunk-km",
      citation_id: "C1", title: "Approved critical policy", excerpt: "Use respectful language.",
      content_hash: "provenance-hash", document_hash: "raw-document-hash", snippet_hash: "raw-snippet-hash",
      approved_at: time, effective_from: null, effective_until: null, source_uri: "synthetic://policy/3" }],
    critical_context: [{ document_id: "doc-km", document_version: "3", chunk_id: "context-1",
      locator: "page 2", text: "Critical full-source evidence stays untrusted.", content_hash: "context-hash" }],
    verification_profile: { embedding_profile: "hashed-bow-v1", semantic_embeddings: false,
      source_correctness_verified_by_code: false, review_depth: "critical", retrieved_text_is_untrusted: true,
      critical_integrity_checks: true, context_expansion: "full_source_within_budget" },
  }]) }));
  await page.goto("/runs/run-1");
  for (let pass = 0; pass < 2; pass++) {
    await expect(page.getByText("Snapshot immutable-km-hash", { exact: true })).toBeVisible();
    await expect(page.getByText("Critical full-source evidence stays untrusted.", { exact: true })).toBeVisible();
    await expect(page.getByText("hashed-bow-v1", { exact: true })).toBeVisible();
    await expect(page.getByText("Semantic embeddings disabled", { exact: true })).toBeVisible();
    await expect(page.getByText("Source correctness unverified by code", { exact: true })).toBeVisible();
    await expect(page.getByText("Document hash raw-document-hash", { exact: true })).toBeVisible();
    await expect(page.getByText("Snippet hash raw-snippet-hash", { exact: true })).toBeVisible();
    await expect(page.getByText("synthetic://policy/3", { exact: true })).toBeVisible();
    await expect(page.locator('a[href^="synthetic:"]')).toHaveCount(0);
    if (pass === 0) await page.reload();
  }
});

for (const reason of ["knowledge_unavailable", "knowledge_reference_invalid"]) {
  test(`knowledge module explains ${reason} without changing stored evidence`, async ({ page }) => {
    await page.route("**/runs/run-1/knowledge?*", (route) => route.fulfill({ json: list([{
      id: "km-blocked", run_id: "run-1", status: "unavailable", source_mode: "knowledge_module",
      required: true, retrieved_at: time, snapshot_hash: "stored-blocked-hash", sources: [], reason_code: reason,
    }]) }));
    await page.goto("/runs/run-1");
    await expect(page.getByText(reason === "knowledge_unavailable" ? "Required knowledge is unavailable" : "Knowledge reference is invalid or revoked", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Knowledge integration status" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Snapshot stored-blocked-hash", { exact: true })).toBeVisible();
  });
}

test("knowledge pages can be selected directly and a failed page preserves loaded evidence", async ({ page }) => {
  const offsets: number[] = [];
  let failPage = true;
  await page.route("**/runs/run-1/knowledge?*", (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    if (offset === 60 && failPage) {
      failPage = false;
      return route.fulfill({ status: 503, json: { detail: "Synthetic page outage" } });
    }
    return route.fulfill({ json: {
      items: Array.from({ length: offset === 60 ? 1 : 20 }, (_, index) => ({
        id: `k${offset + index}`, run_id: "run-1", status: "ready", source_mode: "knowledge_module",
        required: true, retrieved_at: time, snapshot_hash: `page-hash-${offset + index}`, sources: [],
      })), total: 61, limit: 20, offset,
    } });
  });
  await page.goto("/runs/run-1");
  await expect(page.getByText("Snapshot page-hash-0", { exact: true })).toBeVisible();
  await page.getByLabel("Snapshot page").fill("4");
  await page.getByRole("button", { name: "Load snapshot page", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry snapshot page", exact: true })).toBeVisible();
  await expect(page.getByText("Snapshot page-hash-0", { exact: true })).toBeVisible();
  await expect(page.getByText("has no matching source", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Retry snapshot page", exact: true }).click();
  await expect(page.getByText("Snapshot page-hash-60", { exact: true })).toBeVisible();
  expect([...new Set(offsets)]).toEqual([0, 60]);
  expect(offsets.filter((offset) => offset === 60)).toHaveLength(2);
});

test("knowledge module accepts nullable metadata and bounds critical-context previews", async ({ page }) => {
  await page.route("**/runs/run-1/knowledge?*", (route) => route.fulfill({
    json: list([{
      id: "bounded-context", run_id: "run-1", status: "ready", source_mode: "knowledge_module",
      required: true, retrieved_at: time, snapshot_hash: "bounded-hash", verification_profile: null,
      sources: [{ document_id: "doc", document_version: "1", snippet_id: "chunk", citation_id: "C1",
        title: "Nullable metadata source", excerpt: "Approved excerpt", content_hash: "hash",
        approved_at: time, effective_from: null, effective_until: null, source_uri: null,
        document_hash: null, snippet_hash: null }],
      critical_context: Array.from({ length: 21 }, (_, index) => ({
        document_id: "doc", document_version: "1", chunk_id: `context-${index}`,
        locator: `section ${index}`, text: `${"x".repeat(8000)}OMITTED_CONTEXT_SUFFIX`, content_hash: `hash-${index}`,
      })),
    }]),
  }));
  await page.goto("/runs/run-1");
  await expect(page.getByRole("heading", { name: "Nullable metadata source" })).toBeVisible();
  const context = page.getByRole("region", { name: "Critical context" });
  await expect(context.locator("details")).toHaveCount(20);
  await expect(context.getByText("Showing the first 20 critical context entries.")).toBeVisible();
  await expect(page.getByText("OMITTED_CONTEXT_SUFFIX", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Retrieval profile" })).toHaveCount(0);
});

test("same-run version updates preserve loaded citation pages and refresh snapshot availability", async ({ page }) => {
  let advanced = false;
  const offsets: number[] = [];
  await page.route("**/api/v1/runs/run-1", (route) => route.fulfill({
    json: {
      ...run,
      version: advanced ? 4 : 3,
      phase: advanced ? "new_snapshot_available" : "completed",
      artifacts: run.artifacts.map((artifact) => ({ ...artifact, citation_ids: advanced ? ["C1", "C2"] : ["C1"] })),
    },
  }));
  await page.route("**/runs/run-1/knowledge?*", (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    const total = advanced ? 62 : 61;
    return route.fulfill({ json: {
      items: Array.from({ length: Math.min(20, total - offset) }, (_, index) => ({
        id: `retained-${offset + index}`,
        run_id: "run-1",
        status: "ready",
        source_mode: "knowledge_module",
        required: true,
        retrieved_at: time,
        snapshot_hash: `retained-hash-${offset + index}`,
        sources: offset + index === 20 ? [{
          document_id: "retained-doc", document_version: "1", snippet_id: "retained-chunk",
          citation_id: "C1", title: "Retained page-two citation", excerpt: "Approved immutable evidence",
          content_hash: "retained-source-hash", approved_at: time,
          effective_from: null, effective_until: null, source_uri: null,
        }] : offset + index === 61 ? [{
          document_id: "appended-doc", document_version: "1", snippet_id: "appended-chunk",
          citation_id: "C2", title: "Newly appended citation", excerpt: "New immutable evidence",
          content_hash: "appended-source-hash", approved_at: time,
          effective_from: null, effective_until: null, source_uri: null,
        }] : [],
      })),
      total,
      limit: 20,
      offset,
    } });
  });
  await page.goto("/runs/run-1");
  await page.getByLabel("Snapshot page").fill("4");
  await page.getByRole("button", { name: "Load snapshot page", exact: true }).click();
  await expect(page.getByText("Snapshot retained-hash-60", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load next snapshots", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Retained page-two citation" })).toBeVisible();
  const firstPageRequests = offsets.filter((offset) => offset === 0).length;
  const secondPageRequests = offsets.filter((offset) => offset === 20).length;
  advanced = true;
  await page.getByRole("button", { name: "Refresh run", exact: true }).click();
  await expect(page.getByText("new_snapshot_available", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retained page-two citation" })).toBeVisible();
  await expect(page.getByText("Snapshot retained-hash-0", { exact: true })).toBeVisible();
  await expect(page.getByText("Snapshot retained-hash-39", { exact: true })).toBeVisible();
  await expect(page.getByText("Loaded 41 of 62 snapshots.", { exact: false })).toBeVisible();
  await expect(page.getByText("Citation C1 is awaiting", { exact: false })).toHaveCount(0);
  await page.getByRole("link", { name: "C1", exact: true }).click();
  await expect(page.locator("#evidence-run-1-C1")).toBeInViewport();
  expect(offsets.filter((offset) => offset === 0)).toHaveLength(firstPageRequests);
  expect(offsets.filter((offset) => offset === 20)).toHaveLength(secondPageRequests + 1);
  expect([...new Set(offsets)]).toEqual([0, 60, 20]);
  await page.getByRole("button", { name: "Load next snapshots", exact: true }).click();
  await expect(page.getByText("Snapshot retained-hash-59", { exact: true })).toBeVisible();
  await expect(page.getByText("Citation C2 is awaiting unloaded snapshot pages", { exact: false })).toBeVisible();
  await expect(page.getByText("has no matching source", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Load next snapshots", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Newly appended citation" })).toBeVisible();
  await expect(page.getByText("Citation C2 is awaiting", { exact: false })).toHaveCount(0);
  expect([...new Set(offsets)]).toEqual([0, 60, 20, 40]);
});
