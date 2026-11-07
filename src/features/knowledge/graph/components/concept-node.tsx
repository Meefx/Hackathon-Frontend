"use client";

import { memo, type CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KNOWLEDGE_CATEGORIES } from "../categories";
import type { KnowledgeConcept } from "../types";
import { GraphIcon } from "./graph-icon";
import styles from "./knowledge-canvas.module.css";

export type ConceptFlowNode = Node<{
  concept: KnowledgeConcept;
  dimmed: boolean;
  matched: boolean;
  connections: number;
}, "concept">;

export const ConceptNode = memo(function ConceptNode({ data, selected }: NodeProps<ConceptFlowNode>) {
  const category = KNOWLEDGE_CATEGORIES[data.concept.category];
  const color = { "--category-color": category.color, "--category-background": category.background } as CSSProperties;
  return <div className={`${styles.concept} ${selected ? styles.selected : ""} ${data.dimmed ? styles.dimmed : ""} ${data.matched ? styles.matched : ""}`} style={color}>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map(position => <Handle key={`target-${position}`} id={`target-${position}`} type="target" position={position} isConnectable={false} className={styles.handle} />)}
    <div className={styles.nodeTop}><span className={styles.nodeIcon}><GraphIcon name={data.concept.category} size={17} /></span><span className={styles.nodeCategory}>{category.singular}</span><span className={styles.connectionCount} title={`${data.connections} relationships`}>{data.connections}</span></div>
    <div className={styles.nodeTitle}>{data.concept.title}</div>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map(position => <Handle key={`source-${position}`} id={`source-${position}`} type="source" position={position} isConnectable={false} className={styles.handle} />)}
  </div>;
});
