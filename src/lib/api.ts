export type CollectionStatus = "current" | "early" | "late" | "critical";

export interface Account {
  id: string;
  borrower_name: string;
  loan_reference: string;
  outstanding_amount: number;
  due_date: string;
  assigned_to: string;
  days_past_due: number;
  status: CollectionStatus;
}

export interface AccountPage {
  items: Account[];
  total: number;
  limit: number;
  offset: number;
}

export interface Dashboard {
  total_accounts: number;
  total_outstanding: number;
  overdue_accounts: number;
  overdue_amount: number;
  buckets: { status: CollectionStatus; count: number; outstanding_amount: number }[];
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`The request failed (${response.status}). Please try again.`);
  return response.json() as Promise<T>;
}

export function getDashboard(signal?: AbortSignal) {
  return get<Dashboard>("/api/v1/dashboard", signal);
}

export function getAccounts(search: string, status: string, offset: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ search, limit: "10", offset: String(offset) });
  if (status) params.set("status", status);
  return get<AccountPage>(`/api/v1/accounts?${params}`, signal);
}

export const statusLabels: Record<CollectionStatus, string> = {
  current: "Current", early: "1–30 days", late: "31–90 days", critical: "91+ days",
};

export function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}
