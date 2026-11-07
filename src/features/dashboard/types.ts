import type { CollectionStatus } from "@/features/accounts/types";
export interface Dashboard {
  total_accounts: number;
  total_outstanding: number;
  overdue_accounts: number;
  overdue_amount: number;
  buckets: {
    status: CollectionStatus;
    count: number;
    outstanding_amount: number;
  }[];
}
