export interface KnowledgeSource {
  document_id: string;
  document_version: string;
  snippet_id: string;
  citation_id: string;
  title: string;
  excerpt: string;
  content_hash: string;
  approved_at: string;
  effective_from: string | null;
  effective_until: string | null;
  source_uri: string | null;
}
export interface KnowledgeSnapshot {
  id: string;
  run_id: string;
  status: "ready" | "no_results" | "unavailable" | "error";
  source_mode: "knowledge_module" | "demo_fixture";
  required: boolean;
  retrieved_at: string;
  snapshot_hash: string;
  sources: KnowledgeSource[];
  reason_code: string | null;
}
