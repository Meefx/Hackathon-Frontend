"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background, BackgroundVariant, MarkerType, MiniMap, ReactFlow, ReactFlowProvider,
  useNodesInitialized, useNodesState, useReactFlow, useStore, useViewport, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KNOWLEDGE_CATEGORIES } from "../categories";
import { initialPositions } from "../graph-model";
import type { KnowledgeConcept, KnowledgeGraphData, KnowledgeRelationship } from "../types";
import { ConceptNode, type ConceptFlowNode } from "./concept-node";
import { GraphIcon } from "./graph-icon";
import styles from "./knowledge-canvas.module.css";

const nodeTypes = { concept: ConceptNode };

type CanvasProps = {
  data: KnowledgeGraphData;
  concepts: KnowledgeConcept[];
  relationships: KnowledgeRelationship[];
  matches: KnowledgeConcept[];
  selectedId: string | null;
  showLabels: boolean;
  focusTarget: { id: string; revision: number } | null;
  onSelect: (id: string | null) => void;
  onResetFilters: () => void;
};

function Canvas(props: CanvasProps) {
  const { data, concepts, relationships, matches, selectedId, showLabels, focusTarget, onSelect, onResetFilters } = props;
  const positions = useMemo(() => initialPositions(data.concepts), [data]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptFlowNode>(data.concepts.map(concept => ({
    id: concept.id, type: "concept", position: positions[concept.id],
    data: { concept, dimmed: false, matched: false, connections: data.relationships.filter(edge => edge.source === concept.id || edge.target === concept.id).length },
    ariaLabel: `${concept.title}, ${KNOWLEDGE_CATEGORIES[concept.category].singular}. Press Enter to inspect.`,
  })));
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [pinnedEdge, setPinnedEdge] = useState<string | null>(null);
  const flow = useReactFlow<ConceptFlowNode>();
  const initialized = useNodesInitialized();
  const canvasWidth = useStore(state => state.width);
  const { zoom } = useViewport();
  const visibleIds = useMemo(() => new Set(concepts.map(concept => concept.id)), [concepts]);
  const matchedIds = useMemo(() => new Set(matches.map(concept => concept.id)), [matches]);
  const neighborhood = useMemo(() => {
    const connected = new Set(selectedId ? [selectedId] : []);
    relationships.forEach(edge => {
      if (edge.source === selectedId) connected.add(edge.target);
      if (edge.target === selectedId) connected.add(edge.source);
    });
    return connected;
  }, [selectedId, relationships]);

  useEffect(() => {
    setNodes(current => current.map(node => ({
      ...node,
      hidden: !visibleIds.has(node.id),
      selected: node.id === selectedId,
      data: { ...node.data, dimmed: !!selectedId && !neighborhood.has(node.id), matched: matchedIds.has(node.id) },
    })));
  }, [visibleIds, selectedId, neighborhood, matchedIds, setNodes]);

  // Fit after the library has measured the visible custom nodes. Category/search
  // changes fit the current graph while selection alone preserves the viewport.
  const visibleKey = concepts.map(concept => concept.id).join("|");
  useEffect(() => {
    if (!initialized || !visibleKey) return;
    const frame = requestAnimationFrame(() => { void flow.fitView({ padding: 0.14, duration: 350, maxZoom: 1 }); });
    return () => cancelAnimationFrame(frame);
  }, [initialized, visibleKey, canvasWidth, flow]);

  useEffect(() => {
    if (!focusTarget || !initialized || !visibleIds.has(focusTarget.id)) return;
    const frame = requestAnimationFrame(() => {
      const node = flow.getNode(focusTarget.id);
      if (node) void flow.setCenter(node.position.x + 90, node.position.y + 40, { zoom: Math.max(flow.getZoom(), 0.9), duration: 450 });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, initialized, visibleIds, flow]);

  const edges: Edge[] = useMemo(() => relationships.map(relationship => {
    const adjacent = relationship.source === selectedId || relationship.target === selectedId;
    const emphasized = adjacent || relationship.id === hoveredEdge || relationship.id === pinnedEdge;
    const color = emphasized ? "#d4542f" : "#a8a9b0";
    const source = nodes.find(node => node.id === relationship.source)?.position;
    const target = nodes.find(node => node.id === relationship.target)?.position;
    const vertical = source && target && Math.abs(source.x - target.x) < 90;
    const forward = source && target && source.x <= target.x;
    const downward = source && target && source.y <= target.y;
    const reversePair = relationship.source > relationship.target && relationships.some(edge => edge.source === relationship.target && edge.target === relationship.source);
    const sourceSide = reversePair ? "top" : vertical ? downward ? "bottom" : "top" : forward ? "right" : "left";
    const targetSide = reversePair ? "top" : vertical ? downward ? "top" : "bottom" : forward ? "left" : "right";
    return {
      id: relationship.id, source: relationship.source, target: relationship.target,
      sourceHandle: `source-${sourceSide}`, targetHandle: `target-${targetSide}`,
      type: "default", label: showLabels || emphasized ? relationship.relation : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      style: { stroke: color, strokeWidth: emphasized ? 1.9 : 1.2, opacity: selectedId && !emphasized ? 0.2 : emphasized ? 1 : 0.6 },
      labelStyle: { fill: emphasized ? "#9b421f" : "#6d6966", fontSize: 10, fontWeight: emphasized ? 600 : 400 },
      labelBgStyle: { fill: emphasized ? "#fff3e9" : "#fffdfa" }, labelBgPadding: [6, 4], labelBgBorderRadius: 5,
      ariaLabel: `${data.concepts.find(concept => concept.id === relationship.source)?.title} ${relationship.relation} ${data.concepts.find(concept => concept.id === relationship.target)?.title}`,
      interactionWidth: 20, zIndex: emphasized ? 5 : 0,
    };
  }), [relationships, selectedId, hoveredEdge, pinnedEdge, showLabels, data.concepts, nodes]);

  const selectedRelationship = relationships.find(relationship => relationship.id === (pinnedEdge || hoveredEdge));
  const clearSelection = useCallback(() => { onSelect(null); setPinnedEdge(null); }, [onSelect]);

  function resetLayout() {
    setNodes(current => current.map(node => ({ ...node, position: positions[node.id] })));
    requestAnimationFrame(() => { void flow.fitView({ padding: 0.14, duration: 400, maxZoom: 1 }); });
  }

  return <section className={styles.canvas} aria-label="Interactive knowledge graph">
    <ReactFlow<ConceptFlowNode>
      nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeClick={(_, node) => { onSelect(node.id); setPinnedEdge(null); }}
      onNodeDoubleClick={(_, node) => { onSelect(node.id); void flow.setCenter(node.position.x + 90, node.position.y + 40, { zoom: 1.2, duration: 350 }); }}
      onPaneClick={clearSelection}
      onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)} onEdgeMouseLeave={() => setHoveredEdge(null)}
      onEdgeClick={(_, edge) => { setPinnedEdge(edge.id); onSelect(null); }}
      onKeyDown={event => {
        if (event.key === "Escape") { clearSelection(); return; }
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const nodeId = target.closest(".react-flow__node")?.getAttribute("data-id");
        const edgeId = target.closest(".react-flow__edge")?.getAttribute("data-id");
        if (nodeId) { onSelect(nodeId); setPinnedEdge(null); }
        else if (edgeId) { setPinnedEdge(edgeId); onSelect(null); }
      }}
      onNodeDragStart={() => setPinnedEdge(null)}
      fitView fitViewOptions={{ padding: 0.14, maxZoom: 1 }} minZoom={0.25} maxZoom={1.8}
      nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null}
      selectionKeyCode={null} multiSelectionKeyCode={null} selectionOnDrag={false}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ddd5cf" />
      <MiniMap<ConceptFlowNode> style={{ width: 110, height: 74 }} nodeColor={node => KNOWLEDGE_CATEGORIES[node.data.concept.category].color} maskColor="rgba(248, 245, 241, .8)" pannable zoomable className={styles.minimap} ariaLabel="Graph overview. Drag to pan." />
    </ReactFlow>

    <div className={styles.canvasCaption}><span className={styles.liveDot} /> KNOWLEDGE EXPLORER <span className={styles.captionDivider}>/</span> <span>Local demo</span></div>
    <div className={styles.controls} role="group" aria-label="Graph view controls">
      <button type="button" disabled={zoom >= 1.8} onClick={() => void flow.zoomIn({ duration: 200 })} aria-label="Zoom in" title="Zoom in"><GraphIcon name="plus" /></button>
      <span className={styles.zoomValue} aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
      <button type="button" disabled={zoom <= 0.25} onClick={() => void flow.zoomOut({ duration: 200 })} aria-label="Zoom out" title="Zoom out"><GraphIcon name="minus" /></button>
      <span className={styles.controlDivider} />
      <button type="button" onClick={() => void flow.fitView({ padding: 0.14, duration: 400, maxZoom: 1 })} aria-label="Fit graph to view" title="Fit to view"><GraphIcon name="fit" /></button>
      <button type="button" onClick={resetLayout} aria-label="Reset node positions" title="Reset layout"><GraphIcon name="reset" size={16} /></button>
    </div>

    {!concepts.length && <div className={styles.emptyOverlay}><div className={styles.emptyCard} role="status"><GraphIcon name="search" size={30} /><h3>No concepts found</h3><p>Try a different search or bring back more categories and relationships.</p><button type="button" className="button" onClick={onResetFilters}>Reset filters</button></div></div>}

    {selectedRelationship && <div className={styles.relationshipCard} role="status">
      <button type="button" className={styles.closeRelationship} aria-label="Close relationship details" onClick={() => { setPinnedEdge(null); setHoveredEdge(null); }}><GraphIcon name="close" size={15} /></button>
      <span className={styles.relationshipEyebrow}>RELATIONSHIP</span>
      <div className={styles.relationshipPath}><button onClick={() => onSelect(selectedRelationship.source)}>{data.concepts.find(concept => concept.id === selectedRelationship.source)?.title}</button><span>{selectedRelationship.relation} <GraphIcon name="arrow" size={13} /></span><button onClick={() => onSelect(selectedRelationship.target)}>{data.concepts.find(concept => concept.id === selectedRelationship.target)?.title}</button></div>
      <p>{selectedRelationship.description}</p>
    </div>}
    <div className={styles.canvasHint}><span>Drag to explore</span><span>Scroll to zoom</span><span>Click a concept to connect the dots</span></div>
  </section>;
}

export function KnowledgeCanvas(props: CanvasProps) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
