import { test, expect } from "@playwright/test";
import { fixture } from "./fixtures";

test("portal table scroll stays inside the account panel on mobile", async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portal");
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const tableScroll = page.getByRole("table").locator("..");
  await tableScroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await page.getByRole("button", { name: "View Synthetic Borrower's account" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "Discuss with manager", exact: true })).toBeVisible();
});
