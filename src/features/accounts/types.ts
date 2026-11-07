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
