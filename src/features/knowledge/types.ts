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
  document_hash?: string | null;
  snippet_hash?: string | null;
}
export interface CriticalContext {
  document_id: string;
  document_version: string;
  chunk_id: string;
  locator: string;
  text: string;
  content_hash: string;
}
export interface VerificationProfile {
  embedding_profile: string;
  semantic_embeddings: false;
  source_correctness_verified_by_code: false;
  review_depth: "critical" | "standard";
  retrieved_text_is_untrusted: true;
  critical_integrity_checks: boolean;
  context_expansion: string;
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
  snapshot_hash_version?: 1 | 2;
  critical_context?: CriticalContext[];
  verification_profile?: VerificationProfile | null;
  reason_code: string | null;
}
