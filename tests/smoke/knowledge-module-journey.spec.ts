import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { KnowledgeSnapshot } from "../../src/features/knowledge/types";
import type { RunSnapshot } from "../../src/features/runs/types";
import type { DispatchResult } from "../../src/features/conversations/types";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// The retirement request carries a credential, so do not retain request traces.
test.use({ trace: "off" });

test("knowledge_module real worker preserves evidence and blocks dispatch after retirement", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.KNOWLEDGE_MODULE_SMOKE !== "1",
    "Requires an explicitly prepared knowledge-module backend and synthetic document.",
  );
  const documentId = process.env.KNOWLEDGE_DOCUMENT_ID;
  const accountId = process.env.KNOWLEDGE_ACCOUNT_ID;
  const token = process.env.TRUST_API_TOKEN;
  expect(documentId, "KNOWLEDGE_DOCUMENT_ID must identify an approved synthetic critical source").toBeTruthy();
  expect(accountId, "KNOWLEDGE_ACCOUNT_ID must identify a contact-eligible synthetic account").toBeTruthy();
  expect(token, "TRUST_API_TOKEN must authorize synthetic document retirement").toBeTruthy();

  await page.goto(`/manager/tasks?account=${encodeURIComponent(accountId!)}`);
  await page.getByLabel("Instruction").fill(
    "Siapkan pengingat yang sopan berdasarkan konteks yang disetujui.",
  );
  await page.getByRole("button", { name: "Start task", exact: true }).click();
  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText("draft_created", { exact: true })).toBeVisible({ timeout: 45000 });
  const runId = new URL(page.url()).pathname.split("/").at(-1)!;
  const knowledgeUrl = `${api}/api/v1/runs/${encodeURIComponent(runId)}/knowledge?limit=20&offset=0`;
  const beforeResponse = await request.get(knowledgeUrl);
  expect(beforeResponse.ok()).toBeTruthy();
  const before = await beforeResponse.json() as { items: KnowledgeSnapshot[] };
  const snapshot = before.items.find((item) => item.sources.some((source) => source.document_id === documentId));
  expect(snapshot, "The run must cite the prepared synthetic critical source").toBeTruthy();
  expect(snapshot!.source_mode).toBe("knowledge_module");
  expect(snapshot!.snapshot_hash_version).toBe(2);
  expect(snapshot!.critical_context?.length).toBeGreaterThan(0);
  expect(snapshot!.verification_profile?.semantic_embeddings).toBe(false);
  await expect(page.getByText(`Snapshot ${snapshot!.snapshot_hash}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Critical context" })).toBeVisible();
  await expect(page.locator('a[href^="synthetic:"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(`Snapshot ${snapshot!.snapshot_hash}`, { exact: true })).toBeVisible();

  // The trust credential is used only by this Node-side test request.
  const retirement = await request.post(
    `${api}/api/v1/trust/knowledge/documents/${encodeURIComponent(documentId!)}/retire`,
    {
      headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() },
      data: { note: "Synthetic integration revocation" },
    },
  );
  expect(retirement.ok()).toBeTruthy();
  const afterResponse = await request.get(knowledgeUrl);
  expect(afterResponse.ok()).toBeTruthy();
  expect(await afterResponse.json()).toEqual(before);
  const runResponse = await request.get(`${api}/api/v1/runs/${encodeURIComponent(runId)}`);
  expect(runResponse.ok()).toBeTruthy();
  const run = await runResponse.json() as RunSnapshot;
  const messageId = run.artifacts.find((artifact) => artifact.kind === "draft")?.message_id;
  expect(messageId).toBeTruthy();
  await page.getByRole("link", { name: "Open draft in account", exact: true }).click();
  const message = page.locator(`[id="message-${messageId}"]`);
  const dispatchUrl = `${api}/api/v1/messages/${encodeURIComponent(messageId!)}/simulate-dispatch`;
  const dispatchResponse = page.waitForResponse(
    (response) => response.url() === dispatchUrl && response.request().method() === "POST",
  );
  await message.getByRole("button", { name: "Simulate dispatch", exact: true }).click();
  const response = await dispatchResponse;
  expect(response.ok()).toBeTruthy();
  const dispatch = await response.json() as DispatchResult;
  expect(dispatch.message_id).toBe(messageId);
  expect(dispatch.status).toBe("blocked");
  expect(dispatch.reason_codes).toContain("knowledge_reference_invalid");
  const result = page.getByRole("status").filter({ hasText: "blocked:" });
  await expect(result).toContainText("Knowledge reference is invalid or revoked");
  await expect(message.getByText("simulated_sent", { exact: true })).toHaveCount(0);
});
