export interface DiscussionJournal {
  sessionId: string | null;
  runId: string | null;
  mode: "simulated" | "hermes";
  requestKey: string | null;
}

const storageKey = (account: string, review: string) =>
  `collectflow.review-discussion.v1.${encodeURIComponent(account)}.${encodeURIComponent(review)}`;

export function readDiscussion(account: string, review: string): DiscussionJournal | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(account, review)) || "null");
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (item.mode !== "simulated" && item.mode !== "hermes") return null;
    return {
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      runId: typeof item.runId === "string" ? item.runId : null,
      requestKey: typeof item.requestKey === "string" ? item.requestKey : null,
      mode: item.mode,
    };
  } catch {
    return null;
  }
}

export function writeDiscussion(account: string, review: string, value: DiscussionJournal) {
  try {
    localStorage.setItem(storageKey(account, review), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
