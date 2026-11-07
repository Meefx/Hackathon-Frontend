export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const baseUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : null;
    const error =
      detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : null;
    throw new ApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "request_failed",
      typeof detail === "string"
        ? detail
        : typeof error?.message === "string"
          ? error.message
          : `The request failed (${response.status}). Please try again.`,
      typeof error?.correlation_id === "string"
        ? error.correlation_id
        : undefined,
    );
  }
  return response.json() as Promise<T>;
}
export const get = <T>(path: string, signal?: AbortSignal) =>
  request<T>(path, { signal });
export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Connection unavailable. Please try again.";
}
