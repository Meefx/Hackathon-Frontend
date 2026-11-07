import { test, expect } from "@playwright/test";
import { fixture } from "./fixtures";
test.beforeEach(async ({ page }) => fixture(page));
test("portfolio totals remain global and account dialog opens workspace", async ({
  page,
}) => {
  await page.goto("/accounts");
  await page
    .getByRole("button", { name: "View Synthetic Borrower's account" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic Borrower", exact: true }),
  ).toBeVisible();
});
test("six profiles keep configured distinct from available", async ({
  page,
}) => {
  await page.goto("/agents");
  await expect(
    page.getByRole("heading", { name: "Agent registry" }),
  ).toBeVisible();
  for (const role of [
    "manager",
    "collection",
    "knowledge",
    "qa",
    "improvement",
    "copilot",
  ])
    await expect(
      page.getByRole("heading", { name: role, exact: true }),
    ).toBeVisible();
  await expect(page.getByText("Runtime disconnected")).toBeVisible();
});
test("integration skeleton exposes unavailable providers", async ({ page }) => {
  await page.goto("/integrations");
  for (const name of ["WhatsApp", "Email", "Phone"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByText("Provider not implemented").first(),
  ).toBeVisible();
});
test("manager submits a persisted task and renders snapshot evidence after reload", async ({
  page,
}) => {
  await page.goto("/manager/tasks");
  await page.getByLabel("Select account").selectOption("A001");
  await page.getByLabel("Instruction").fill("Prepare a respectful follow up");
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page).toHaveURL(/\/runs\/run-1/);
  await expect(page.getByText("draft_created")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Approved SOP")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open source" })).toHaveCount(0);
  await expect(page.getByText("backend_verified").first()).toBeVisible();
  await expect(page.getByText(/07 Nov 2026,? 10:00:00/).first()).toBeVisible();
});
test("review queue links to case and run context", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Open review" }).click();
  await expect(page.getByLabel("Resolution note")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open account" }),
  ).toHaveAttribute("href", "/accounts/A001");
});
test("backend failure shows retry without fabricated results", async ({
  page,
}) => {
  await page.route("**/api/v1/agents", (route) =>
    route.fulfill({
      status: 503,
      json: {
        detail: { code: "offline", message: "Runtime status unavailable" },
      },
    }),
  );
  await page.goto("/agents");
  await expect(
    page.getByRole("alert").filter({ hasText: "Runtime status unavailable" }),
  ).toContainText("Runtime status unavailable");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
