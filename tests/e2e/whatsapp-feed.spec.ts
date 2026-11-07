import { expect, test } from "@playwright/test";
import { fixture, time } from "./fixtures";

test.beforeEach(async ({ page }) => { await fixture(page); });

test("dashboard shows the agent WhatsApp text and opens the borrower conversation", async ({ page }) => {
  await page.route("**/api/v1/whatsapp/messages?*", route => route.fulfill({ json: {
    total: 1, limit: 10, offset: 0, items: [{
      borrower_name: "Synthetic Borrower", loan_reference: "LN-001",
      message: { id: "wa-1", account_id: "A001", run_id: "run-1", channel: "whatsapp",
        direction: "outbound", text: "Selamat pagi, silakan periksa tagihan Anda.\nTerima kasih.",
        status: "read", version: 1, citation_ids: [], created_at: time },
    }],
  } }));
  await page.goto("/portal");
  const feed = page.getByRole("region", { name: "Agent WhatsApp messages" });
  await expect(feed.getByText("Selamat pagi, silakan periksa tagihan Anda. Terima kasih.")).toBeVisible();
  await expect(feed.getByText("Read", { exact: true })).toBeVisible();
  await feed.getByRole("link", { name: "Open conversation" }).click();
  await expect(page).toHaveURL(/\/accounts\/A001#conversation/);
  await expect(page.getByRole("heading", { name: "Conversation", exact: true })).toBeVisible();
});

test("dashboard WhatsApp feed retries errors and shows an empty history", async ({ page }) => {
  let unavailable = true;
  await page.route("**/api/v1/whatsapp/messages?*", route => unavailable
    ? route.fulfill({ status: 503, json: { detail: "Feed unavailable" } })
    : route.fulfill({ json: { items: [], total: 0, limit: 10, offset: 0 } }));
  await page.goto("/portal");
  const feed = page.getByRole("region", { name: "Agent WhatsApp messages" });
  await expect(feed.getByRole("alert")).toBeVisible();
  unavailable = false;
  await feed.getByRole("button", { name: "Try again" }).click();
  await expect(feed.getByText("No WhatsApp messages sent yet.")).toBeVisible();
});

test("WhatsApp history paginates on mobile and refreshes new agent messages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  let refreshed = false;
  await page.route("**/api/v1/whatsapp/messages?*", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    return route.fulfill({ json: {
      total: 2, limit: 1, offset, items: [{
        borrower_name: "Synthetic Borrower", loan_reference: "LN-001",
        message: { id: `wa-${offset}`, account_id: "A001", run_id: "run-1", channel: "whatsapp",
          direction: "outbound", text: offset ? "Earlier agent reminder" : refreshed ? "New agent follow-up" : "Latest agent reminder",
          status: offset ? "delivery_unknown" : "delivered", version: 1, citation_ids: [], created_at: time },
      }],
    } });
  });
  await page.goto("/portal");
  const feed = page.getByRole("region", { name: "Agent WhatsApp messages" });
  await expect(feed.getByText("Latest agent reminder")).toBeVisible();
  await feed.getByRole("button", { name: "Next messages" }).click();
  await expect(feed.getByText("Earlier agent reminder")).toBeVisible();
  await expect(feed.getByText("Delivery unconfirmed", { exact: true })).toBeVisible();
  await expect(feed.getByRole("button", { name: "Next messages" })).toBeDisabled();
  await feed.getByRole("button", { name: "Previous messages" }).click();
  await expect(feed.getByText("Latest agent reminder")).toBeVisible();
  refreshed = true;
  await page.clock.fastForward(15000);
  await expect(feed.getByText("New agent follow-up")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await feed.screenshot({ path: "/tmp/hackathon-whatsapp-feed-mobile.png" });
});
