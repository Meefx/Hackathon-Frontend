import { get } from "@/lib/http";
import type { AgentDefinition } from "./types";
export const getAgents = (signal?: AbortSignal) =>
  get<{ items: AgentDefinition[] }>("/api/v1/agents", signal);
