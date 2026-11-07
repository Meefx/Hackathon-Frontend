import { test, expect } from "@playwright/test";
import { fixture, time } from "./fixtures";

test.beforeEach(async ({ page }) => fixture(page));

for (const configured of [false, true]) {
  test(`Gmail sandbox shows backend setup with configured=${configured}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: configured ? 1280 : 375, height: 900 });
    await page.route("**/api/v1/integrations", (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: "gmail",
              kind: "channel",
              implemented: true,
              configured,
              health: configured ? "unknown" : "unavailable",
              execution_mode: configured ? "sandbox" : "unavailable",
              capabilities: ["oauth2", "sandbox_send_test"],
              disabled_reason: configured ? null : "gmail_not_configured",
              checked_at: time,
            },
          ],
        },
      }),
    );
    await page.route("**/api/v1/integrations/gmail/collection-demo", route =>
      route.fulfill({ json: { configured, recipient_masked: configured ? "t***@example.com" : null, latest: null } }),
    );

    await page.goto("/integrations");
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Gmail API sandbox", exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(card.getByText(configured ? "unknown" : "unavailable", {
      exact: true,
    })).toHaveCount(configured ? 1 : 2);
    await expect(card).toContainText(
      configured
        ? "Connection health awaits a backend test."
        : "Configure OAuth credentials and a fixed team test recipient in the backend.",
    );
    await expect(card).toContainText(
      "uv run python -m app.integrations.gmail authorize",
    );
    await expect(card).toContainText(
      "uv run python -m app.integrations.gmail send-test --request-id 00000000-0000-4000-8000-000000000001",
    );
    await expect(card).toContainText("Reuse the request ID for an exact retry.");
    await expect(card).toContainText("Choose a fresh UUID for each intentional new test.");
    await expect(card).toContainText("Gmail API acceptance");
    await expect(card).toContainText("checked in the test mailbox");
    const demoButton = card.getByRole("button", { name: "Run email collection demo", exact: true });
    if (configured) await expect(demoButton).toBeEnabled();
    else await expect(demoButton).toBeDisabled();
    await expect(card.getByRole("textbox")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(configured ? 1280 : 375);
  });
}
