import { expect, test, type Page } from "@playwright/test";
import { fixture, list, time } from "./fixtures";

const endpoint = "**/api/v1/integrations/gmail/collection-demo";
const journalKey = "graceline.gmail-collection-demo.v1";
const queued = {
  id: "email-demo-1", account_id: "DEMO-1", run_id: "email-run-1", status: "queued",
  reason_codes: [], recipient_masked: "d***@example.com", message_id: null,
  provider_message_id: null, created_at: time, updated_at: time, runtime_mode: "simulated",
};
const submitted = {
  ...queued, status: "submitted", message_id: "message-1", provider_message_id: "gmail-provider-1",
};

async function demoFixture(page: Page, configured = true) {
  await fixture(page);
  await page.route("**/api/v1/integrations", route => route.fulfill({ json: { items: [{
    id: "gmail", kind: "channel", implemented: true, configured,
    health: configured ? "unknown" : "unavailable", execution_mode: "sandbox",
    capabilities: ["sandbox_collection_demo"], disabled_reason: configured ? null : "gmail_not_configured", checked_at: time,
  }] } }));
  await page.route(endpoint, route => route.fulfill({ json: {
    configured, recipient_masked: configured ? "d***@example.com" : null, latest: null,
  } }));
}

test("operator click starts one persisted email demo and polls until Gmail accepts it", async ({ page }) => {
  await demoFixture(page);
  const writes: unknown[] = [];
  await page.route(endpoint, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest: null } });
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, json: queued });
  });
  let reads = 0;
  await page.route(`${endpoint}/*`, route => route.fulfill({ json: ++reads === 1 ? { ...queued, status: "running" } : submitted }));
  await page.goto("/integrations");
  await expect(page.getByText("d***@example.com", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Run email collection demo", exact: true }).click();
  await expect(page.getByText("submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("gmail-provider-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open demo account" })).toHaveAttribute("href", "/accounts/DEMO-1");
  await expect(page.getByRole("link", { name: "Inspect email run" })).toHaveAttribute("href", "/runs/email-run-1");
  expect(writes).toEqual([{ idempotency_key: expect.any(String), runtime_mode: "simulated" }]);
  await page.reload();
  await expect(page.getByText("gmail-provider-1", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
});

test("lost acceptance preserves the request key across reload and explicit retry", async ({ page }) => {
  await demoFixture(page);
  const writes: { idempotency_key: string }[] = [];
  await page.route(endpoint, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest: null } });
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) return route.abort();
    await route.fulfill({ status: 202, json: submitted });
  });
  await page.goto("/integrations");
  await page.getByRole("button", { name: "Run email collection demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry same email demo", exact: true })).toBeVisible();
  const saved = await page.evaluate(key => localStorage.getItem(key), journalKey);
  expect(JSON.parse(saved || "null")).toEqual({ demoId: null, idempotencyKey: writes[0].idempotency_key, runtimeMode: "simulated" });
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry same email demo", exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  await page.getByRole("button", { name: "Retry same email demo", exact: true }).click();
  await expect(page.getByText("gmail-provider-1", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});

test("another completed demo uses a fresh request key and synthetic account", async ({ page }) => {
  await demoFixture(page);
  const keys: string[] = [];
  await page.route(endpoint, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest: null } });
    keys.push(route.request().postDataJSON().idempotency_key);
    await route.fulfill({ status: 202, json: { ...submitted, id: `email-demo-${keys.length}`, account_id: `DEMO-${keys.length}` } });
  });
  await page.goto("/integrations");
  await page.getByRole("button", { name: "Run email collection demo", exact: true }).click();
  await page.getByRole("button", { name: "Run another email demo", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open demo account" })).toHaveAttribute("href", "/accounts/DEMO-2");
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toEqual(keys[0]);
});

test("missing Gmail configuration disables demo creation", async ({ page }) => {
  await demoFixture(page, false);
  await page.goto("/integrations");
  await expect(page.getByRole("button", { name: "Run email collection demo", exact: true })).toBeDisabled();
});

test("reload resumes a running demo through reads and keeps creation locked", async ({ page }) => {
  await demoFixture(page);
  let writes = 0;
  let completed = false;
  let reads = 0;
  await page.route(endpoint, route => {
    if (route.request().method() === "POST") writes += 1;
    return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest: queued } });
  });
  await page.route(`${endpoint}/*`, route => {
    reads += 1;
    return route.fulfill({ json: completed ? submitted : { ...queued, status: "running" } });
  });
  await page.goto("/integrations");
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Email demo in progress…", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText("running", { exact: true })).toBeVisible();
  const restoredReads = reads;
  completed = true;
  await expect(page.getByText("submitted", { exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(restoredReads);
  expect(writes).toBe(0);
});

for (const status of ["blocked", "delivery_unknown"] as const) {
  test(`${status} remains visible without automatic delivery retry`, async ({ page }) => {
    await demoFixture(page);
    let writes = 0;
    const latest = { ...queued, status, reason_codes: [status === "blocked" ? "contact_outside_window" : "gmail_delivery_unknown"] };
    await page.route(endpoint, route => {
      if (route.request().method() === "POST") writes += 1;
      return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest } });
    });
    await page.route(`${endpoint}/*`, route => route.fulfill({ json: latest }));
    await page.goto("/integrations");
    await expect(page.getByText(status, { exact: true })).toBeVisible();
    await expect(page.getByText(latest.reason_codes[0], { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run another email demo", exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByText(status, { exact: true })).toBeVisible();
    expect(writes).toBe(0);
  });
}

test("email drafts show automatic delivery while simulated drafts retain manual dispatch", async ({ page }) => {
  await fixture(page);
  await page.route("**/accounts/A001/messages?*", route => route.fulfill({ json: list([
    {
      id: "email-draft", account_id: "A001", run_id: "run-1", channel: "email",
      direction: "outbound", text: "Synthetic email draft", status: "draft", version: 1,
      citation_ids: ["C1"], created_at: time,
    },
    {
      id: "simulated-draft", account_id: "A001", run_id: "run-1", channel: "simulated_chat",
      direction: "outbound", text: "Synthetic chat draft", status: "draft", version: 1,
      citation_ids: ["C1"], created_at: time,
    },
  ]) }));
  const dispatched: string[] = [];
  await page.route("**/messages/*/simulate-dispatch", route => {
    dispatched.push(route.request().url());
    return route.fulfill({ json: {
      message_id: "simulated-draft", status: "simulated_sent", reason_codes: [], audit_event_id: "audit-simulated",
    } });
  });
  await page.goto("/accounts/A001");
  const email = page.locator("#message-email-draft");
  await expect(email.getByText("Synthetic email draft", { exact: true })).toBeVisible();
  await expect(email.getByRole("button", { name: "Simulate dispatch", exact: true })).toHaveCount(0);
  await expect(email.getByText("Email demo delivery is managed automatically.", { exact: true })).toBeVisible();
  const chat = page.locator("#message-simulated-draft");
  await chat.getByRole("button", { name: "Simulate dispatch", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "simulated_sent" })).toBeVisible();
  expect(dispatched).toHaveLength(1);
  expect(dispatched[0]).toContain("/messages/simulated-draft/simulate-dispatch");
});

test("Hermes email selection survives an uncertain submission and reload", async ({ page }) => {
  await demoFixture(page);
  const writes: Array<{ idempotency_key: string; runtime_mode: string }> = [];
  await page.route(endpoint, async route => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { configured: true, recipient_masked: "d***@example.com", latest: null } });
    }
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) return route.abort("failed");
    return route.fulfill({ status: 202, json: { ...submitted, runtime_mode: "hermes" } });
  });
  await page.goto("/integrations");
  await page.getByLabel("Email agent runtime").selectOption("hermes");
  await page.getByRole("button", { name: "Run email collection demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry same email demo", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Email agent runtime")).toHaveValue("hermes");
  await expect(page.getByLabel("Email agent runtime")).toBeDisabled();
  await page.getByRole("button", { name: "Retry same email demo", exact: true }).click();
  await expect(page.getByText("submitted", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].runtime_mode).toBe("hermes");
  expect(writes[1]).toEqual(writes[0]);
});
