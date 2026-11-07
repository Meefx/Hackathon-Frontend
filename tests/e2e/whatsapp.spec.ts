import { test, expect } from "@playwright/test";
import { fixture, list, time } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await fixture(page);
  await page.route("**/accounts/A001/whatsapp", (route) => route.fulfill({
    json: {
      account_id: "A001", configured: true, linked: true,
      session_status: "WORKING", recipient_masked: "••••0000",
      mode: "sandbox", reason_codes: [],
    },
  }));
});

test("linked empty conversation polls the first WhatsApp inbound", async ({ page }) => {
  let arrived = false;
  await page.route("**/accounts/A001/messages?*", (route) => route.fulfill({
    json: list(arrived ? [{
      id: "phone-reply", account_id: "A001", run_id: null,
      channel: "whatsapp", direction: "inbound", text: "Synthetic phone reply",
      status: "received", version: 1, citation_ids: [], created_at: time,
    }] : []),
  }));
  await page.goto("/accounts/A001");
  await expect(page.getByRole("button", { name: "Disconnect WhatsApp test channel" })).toBeVisible();
  await expect(page.getByText("Synthetic phone reply", { exact: true })).toHaveCount(0);
  arrived = true;
  await expect(page.getByText("Synthetic phone reply", { exact: true })).toBeVisible({ timeout: 12000 });
});

test("WhatsApp draft uses the real dispatch endpoint", async ({ page }) => {
  await page.route("**/api/v1/integrations", (route) => route.fulfill({
    json: { items: [{ id: "whatsapp", kind: "channel", implemented: true,
      configured: true, health: "unknown", execution_mode: "sandbox",
      capabilities: [], disabled_reason: null, checked_at: time }] },
  }));
  await page.route("**/accounts/A001/messages?*", (route) => route.fulfill({
    json: list([{
      id: "wa-draft", account_id: "A001", run_id: "run-1",
      channel: "whatsapp", direction: "outbound", text: "Synthetic approved draft",
      status: "draft", version: 1, citation_ids: ["C1"], created_at: time,
    }]),
  }));
  const requests: unknown[] = [];
  await page.route("**/messages/wa-draft/dispatch", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      message_id: "wa-draft", status: "submitted", reason_codes: [], audit_event_id: "audit-wa",
    } });
  });
  await page.goto("/accounts/A001");
  await page.getByRole("button", { name: "Send WhatsApp test", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "submitted" })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ expected_message_version: 1 });
});
