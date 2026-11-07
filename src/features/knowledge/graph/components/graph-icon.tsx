import type { CSSProperties } from "react";
import type { KnowledgeCategory } from "../types";

export type GraphIconName = KnowledgeCategory | "graph" | "search" | "close" | "arrow" | "fit" | "reset" | "plus" | "minus" | "filter" | "focus" | "chevron" | "info" | "layers";

const paths: Record<GraphIconName, React.ReactNode> = {
  policy: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  compliance: <><path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="M8 12l3 3 5-6"/></>,
  procedure: <><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h6a3 3 0 013 3v6M15 12l3 3 3-3M6 9v9h5"/></>,
  situation: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0116 0v2"/></>,
  capability: <><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M1 12v4M23 12v4M8 16h8M8 11h.01M16 11h.01"/></>,
  document: <><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5"/></>,
  graph: <><circle cx="12" cy="12" r="3"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><path d="M6 6l4 4M14 10l4-4M10 14l-4 4M14 14l4 4"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/></>,
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  arrow: <path d="M4 12h16M14 6l6 6-6 6"/>,
  fit: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z"/>,
  reset: <><path d="M3 10a9 9 0 119 11M3 4v6h6"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z"/>,
  focus: <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
  chevron: <path d="M9 5l7 7-7 7"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  layers: <><path d="M12 3l10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6"/></>,
};

export function GraphIcon({ name, size = 18, className, style }: {
  name: GraphIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
