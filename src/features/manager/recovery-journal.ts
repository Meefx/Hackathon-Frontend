import type { RecoveryJournal } from "./types";
const key = "collectflow.pending-run.v1";
export function readJournal(): RecoveryJournal | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (
      value &&
      typeof value === "object" &&
      "accountId" in value &&
      "requestKey" in value &&
      typeof value.accountId === "string" &&
      typeof value.requestKey === "string"
    ) {
      const item = value as Record<string, unknown>;
      return {
        accountId: value.accountId,
        requestKey: value.requestKey,
        sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
        runId: typeof item.runId === "string" ? item.runId : null,
      };
    }
  } catch {}
  return null;
}
export function writeJournal(value: RecoveryJournal) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearJournal() {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function acknowledgeRun(runId: string, accountId: string) {
  const journal = readJournal();
  if (journal?.runId === runId && journal.accountId === accountId)
    clearJournal();
}
