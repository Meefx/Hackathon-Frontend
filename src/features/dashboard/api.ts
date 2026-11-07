import { get } from "@/lib/http";
import type { Dashboard } from "./types";
export const getDashboard = (signal?: AbortSignal) =>
  get<Dashboard>("/api/v1/dashboard", signal);
