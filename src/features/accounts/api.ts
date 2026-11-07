import { get, query } from "@/lib/http";
import type { Account, AccountPage } from "./types";
export const getAccount = (id: string, signal?: AbortSignal) =>
  get<Account>(`/api/v1/accounts/${encodeURIComponent(id)}`, signal);
export const getAccounts = (
  search: string,
  status: string,
  offset: number,
  signal?: AbortSignal,
) =>
  get<AccountPage>(
    `/api/v1/accounts?${query({ search, status, offset, limit: 10 })}`,
    signal,
  );
