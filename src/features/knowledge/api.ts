import { get, type Page } from "@/lib/http";
import type { KnowledgeSnapshot } from "./types";
export const getKnowledge = (id: string, signal?: AbortSignal, offset = 0) =>
  get<Page<KnowledgeSnapshot>>(
    `/api/v1/runs/${encodeURIComponent(id)}/knowledge?limit=20&offset=${offset}`,
    signal,
  );
