import { test, expect } from "@playwright/test";
const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
test("real PostgreSQL worker journey: task evidence, reload, dispatch, escalation, resolve", async ({
  page,
  request,
}) => {
  const response = await request.get(`${api}/api/v1/accounts?limit=100`);
  expect(response.ok()).toBeTruthy();
  const accounts = (await response.json()).items as { id: string }[];
  let chosen = "";
  for (const item of [...accounts].reverse()) {
    const policy = await request.get(
      `${api}/api/v1/accounts/${item.id}/contact-policy`,
    );
    if (policy.ok() && (await policy.json()).allowed) {
      chosen = item.id;
      break;
    }
  }
  expect(
    chosen,
    "At least one synthetic account must be contact eligible",
  ).not.toBe("");
  await page.goto(`/manager/tasks?account=${chosen}`);
  await page
    .getByLabel("Instruction")
    .fill("Siapkan pengingat yang sopan berdasarkan konteks yang disetujui.");
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText("draft_created", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(
    page.getByText("demo_fixture", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("draft_created", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Open draft in account", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Simulate dispatch", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("simulated_sent", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByLabel("Borrower message")
    .fill("Saya ingin berbicara dengan petugas manusia.");
  await page.getByLabel("Demo inbound scenario").selectOption("human_request");
  await page.getByRole("button", { name: "Receive simulated inbound" }).click();
  await expect(
    page.getByText("paused_human_review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  const row = page
    .locator("li")
    .filter({ hasText: chosen })
    .filter({ has: page.getByRole("button", { name: "Open review" }) })
    .first();
  await row.getByRole("button", { name: "Open review" }).click();
  await page
    .getByLabel("Resolution note")
    .fill("Synthetic smoke verified human request; operator retains handling.");
  await page
    .getByRole("button", { name: "Resolve review", exact: true })
    .click();
  await expect(
    page.getByText("Review resolved. Case paused_operator", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("pause resolution applied. Resume was not requested.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("resume applied", { exact: false })).toHaveCount(
    0,
  );
  await page.goto(`/manager/tasks?account=${chosen}`);
  await page
    .getByLabel("Instruction")
    .fill("Periksa apakah akun yang sedang ditahan boleh dihubungi.");
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText("blocked", { exact: true }).first()).toBeVisible({
    timeout: 45000,
  });
  await expect(
    page.getByText("Case contact is paused", { exact: false }),
  ).toBeVisible();
});
for (const task of ["collector_brief", "improvement_review"] as const) {
  test(`real worker ${task} creates persisted artifact`, async ({ page }) => {
    await page.goto("/manager/tasks?account=CF-1006");
    await page.getByLabel("Task type").selectOption(task);
    await page
      .getByLabel("Instruction")
      .fill(
        "Susun ringkasan berdasarkan bukti yang disetujui untuk tinjauan manusia.",
      );
    await page.getByRole("button", { name: "Start task", exact: true }).click();
    await expect(page).toHaveURL(/\/runs\//);
    await expect(
      page.getByText(
        task === "collector_brief" ? "brief_created" : "proposal_created",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 45000 });
    await expect(
      page.getByRole("heading", {
        name:
          task === "collector_brief"
            ? "collector brief"
            : "improvement proposal",
        exact: true,
      }),
    ).toBeVisible();
  });
}
