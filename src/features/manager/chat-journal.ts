import type { ChatJournal } from "./types";

const key = "graceline.manager-chat.v1";
export function readChatJournal(): ChatJournal | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (item.mode !== "simulated" && item.mode !== "hermes") return null;
    const nullableId = (field: unknown) => field === null || typeof field === "string";
    if (![item.sessionId, item.runId, item.requestKey, item.contextAccountId].every(nullableId)) return null;
    return item as unknown as ChatJournal;
  } catch {
    return null;
  }
}
export function writeChatJournal(value: ChatJournal) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
