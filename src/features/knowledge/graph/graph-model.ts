import { CATEGORY_ORDER } from "./categories";
import type { KnowledgeCategory, KnowledgeConcept, KnowledgeGraphData, KnowledgeRelationship } from "./types";

export const RELATIONSHIPS: KnowledgeRelationship["relation"][] = [
  "applies to", "requires", "references", "depends on", "triggers", "prohibits", "supports",
];

// Presentation coordinates live outside the knowledge model. A real source adapter
// can replace the demo data without carrying canvas-specific fields.
export function initialPositions(concepts: KnowledgeConcept[]) {
  const columns: Record<KnowledgeCategory, { x: number; y: number; step: number }> = {
    situation: { x: 0, y: 250, step: 175 },
    procedure: { x: 270, y: 100, step: 170 },
    policy: { x: 540, y: 180, step: 165 },
    compliance: { x: 810, y: 40, step: 175 },
    capability: { x: 270, y: 850, step: 0 },
    document: { x: 1080, y: 180, step: 170 },
  };
  const positions: Record<string, { x: number; y: number }> = {};
  for (const category of CATEGORY_ORDER) {
    concepts.filter(concept => concept.category === category).forEach((concept, index) => {
      const column = columns[category];
      positions[concept.id] = {
        x: column.x + (category === "capability" ? index * 270 : 0),
        y: column.y + index * column.step,
      };
    });
  }
  return positions;
}

export function findConcepts(data: KnowledgeGraphData, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return data.concepts.filter(concept => {
    const text = [concept.title, concept.summary, concept.description, concept.category, ...concept.tags,
      ...data.sources.filter(source => concept.sourceIds.includes(source.id)).map(source => `${source.title} ${source.reference}`),
    ].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function getVisibleGraph(data: KnowledgeGraphData, options: {
  categories: KnowledgeCategory[];
  query: string;
  relation: string;
  selectedId: string | null;
  focusOnly: boolean;
}) {
  const eligible = new Set(data.concepts.filter(concept => options.categories.includes(concept.category)).map(concept => concept.id));
  let relationships = data.relationships.filter(edge => eligible.has(edge.source) && eligible.has(edge.target) && (options.relation === "all" || edge.relation === options.relation));
  const matches = findConcepts(data, options.query).filter(concept => eligible.has(concept.id));
  let visible = eligible;
  if (options.query.trim()) {
    const matched = new Set(matches.map(concept => concept.id));
    visible = new Set(matched);
    for (const edge of relationships) {
      if (matched.has(edge.source) || matched.has(edge.target)) {
        visible.add(edge.source);
        visible.add(edge.target);
      }
    }
  }
  if (options.focusOnly && options.selectedId) {
    const neighborhood = new Set([options.selectedId]);
    relationships.forEach(edge => {
      if (edge.source === options.selectedId) neighborhood.add(edge.target);
      if (edge.target === options.selectedId) neighborhood.add(edge.source);
    });
    visible = new Set([...visible].filter(id => neighborhood.has(id)));
  }
  if (options.relation !== "all") {
    const connected = new Set(relationships.flatMap(edge => [edge.source, edge.target]));
    visible = new Set([...visible].filter(id => connected.has(id)));
  }
  relationships = relationships.filter(edge => visible.has(edge.source) && visible.has(edge.target));
  return { concepts: data.concepts.filter(concept => visible.has(concept.id)), relationships, matches };
}

export async function loadDemoGraph(): Promise<KnowledgeGraphData> {
  const { DEMO_KNOWLEDGE_GRAPH: data } = await import("./demo-data");
  const concepts = new Set(data.concepts.map(concept => concept.id));
  const sources = new Set(data.sources.map(source => source.id));
  if (concepts.size !== data.concepts.length || data.relationships.some(edge => !concepts.has(edge.source) || !concepts.has(edge.target)) || data.concepts.some(concept => concept.sourceIds.some(id => !sources.has(id)))) {
    throw new Error("The knowledge source contains an unresolved reference. Reload the demo to try again.");
  }
  return data;
}
