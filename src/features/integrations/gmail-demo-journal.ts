interface GmailDemoJournal {
  demoId: string | null;
  idempotencyKey: string | null;
}

const key = "graceline.gmail-collection-demo.v1";

export function readGmailDemoJournal(): GmailDemoJournal | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const validId = (id: unknown) => id === null || (typeof id === "string" && id.length > 0);
    if (!validId(item.demoId) || !validId(item.idempotencyKey)) return null;
    return { demoId: item.demoId as string | null, idempotencyKey: item.idempotencyKey as string | null };
  } catch {
    return null;
  }
}

export function writeGmailDemoJournal(value: GmailDemoJournal) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
