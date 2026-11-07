export type KnowledgeCategory =
  | "policy"
  | "compliance"
  | "procedure"
  | "situation"
  | "capability"
  | "document";

export interface KnowledgeConcept {
  id: string;
  title: string;
  category: KnowledgeCategory;
  summary: string;
  description: string;
  tags: string[];
  sourceIds: string[];
}

export interface KnowledgeRelationship {
  id: string;
  source: string;
  target: string;
  relation:
    | "applies to"
    | "requires"
    | "references"
    | "depends on"
    | "triggers"
    | "prohibits"
    | "supports";
  description: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  reference: string;
  excerpt: string;
  kind:
    | "Policy handbook"
    | "Compliance guide"
    | "Operating procedure"
    | "Capability guide";
  version: string;
}

export interface KnowledgeGraphData {
  concepts: KnowledgeConcept[];
  relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[];
  synthetic: true;
  updatedAt: string;
}
