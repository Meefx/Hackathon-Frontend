export interface PendingDispatch {
  idempotency_key: string;
  expected_message_version: number;
}

const keyFor = (messageId: string) => `graceline.draft-dispatch.v1.${messageId}`;

export function readDispatchJournal(messageId: string): PendingDispatch | null {
  const saved: unknown = JSON.parse(localStorage.getItem(keyFor(messageId)) || "null");
  if (!saved || typeof saved !== "object") return null;
  const value = saved as Record<string, unknown>;
  if (typeof value.idempotency_key !== "string" || !value.idempotency_key
    || typeof value.expected_message_version !== "number"
    || !Number.isInteger(value.expected_message_version) || value.expected_message_version < 1) return null;
  return {
    idempotency_key: value.idempotency_key,
    expected_message_version: value.expected_message_version,
  };
}

export function writeDispatchJournal(messageId: string, request: PendingDispatch | null) {
  try {
    if (request) localStorage.setItem(keyFor(messageId), JSON.stringify(request));
    else localStorage.removeItem(keyFor(messageId));
    return true;
  } catch {
    return false;
  }
}
