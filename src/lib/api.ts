// Compatibility exports for existing CollectFlow consumers. New features use domain entry points.
export type {
  Account,
  AccountPage,
  CollectionStatus,
} from "@/features/accounts/types";
export type { Dashboard } from "@/features/dashboard/types";
export { getAccounts } from "@/features/accounts/api";
export { getDashboard } from "@/features/dashboard/api";
export { statusLabels } from "@/features/accounts/constants";
export { currency, formatDate } from "./format";
