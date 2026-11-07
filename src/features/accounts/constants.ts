import type { CollectionStatus } from "./types";
export const statusLabels: Record<CollectionStatus, string> = {
  current: "Current",
  early: "1–30 days",
  late: "31–90 days",
  critical: "91+ days",
};
