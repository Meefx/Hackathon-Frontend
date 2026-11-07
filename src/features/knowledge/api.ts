import { get, type Page } from "@/lib/http";
import type { KnowledgeSnapshot } from "./types";
export const getKnowledge = (id: string, signal?: AbortSignal, offset = 0) =>
  get<Page<KnowledgeSnapshot>>(
    `/api/v1/runs/${encodeURIComponent(id)}/knowledge?limit=20&offset=${offset}`,
    signal,
  );

// A citation can point to any immutable retrieval made by this run. Resolve the
// full ordered history before declaring a citation absent or rendering anchors.
export async function getKnowledgeHistory(id: string, signal?: AbortSignal) {
  const snapshots: KnowledgeSnapshot[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total = 0;
  do {
    const page = await getKnowledge(id, signal, offset);
    total = page.total;
    if (!page.items.length && offset < total)
      throw new Error(
        "Knowledge snapshot history is incomplete. Refresh snapshots.",
      );
    for (const snapshot of page.items) {
      if (!seen.has(snapshot.id)) {
        snapshots.push(snapshot);
        seen.add(snapshot.id);
      }
    }
    offset += 20;
  } while (offset < total);
  return snapshots;
}
