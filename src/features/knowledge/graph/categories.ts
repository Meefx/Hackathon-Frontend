import type { KnowledgeCategory } from "./types";

export const KNOWLEDGE_CATEGORIES: Record<KnowledgeCategory, {
  label: string;
  singular: string;
  color: string;
  background: string;
}> = {
  policy: { label: "Collection policies", singular: "Policy", color: "#d4542f", background: "#fff0e8" },
  compliance: { label: "Compliance rules", singular: "Compliance", color: "#7c5ab8", background: "#f3edfc" },
  procedure: { label: "Procedures", singular: "Procedure", color: "#347cc0", background: "#eaf3fd" },
  situation: { label: "Borrower situations", singular: "Situation", color: "#b47b19", background: "#fff6df" },
  capability: { label: "Agent capabilities", singular: "Capability", color: "#278575", background: "#e8f6f1" },
  document: { label: "Source documents", singular: "Document", color: "#6d7c90", background: "#eef1f6" },
};

export const CATEGORY_ORDER = Object.keys(KNOWLEDGE_CATEGORIES) as KnowledgeCategory[];
