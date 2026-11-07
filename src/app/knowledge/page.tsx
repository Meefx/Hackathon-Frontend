import type { Metadata } from "next";
import { KnowledgeWorkspace } from "@/features/knowledge/graph/components/knowledge-workspace";

export const metadata: Metadata = {
  title: "Knowledge graph | CollectFlow",
  description: "Explore connected collection policies, compliance, procedures, borrower situations, and agent capabilities with synthetic demo knowledge.",
};

export default function KnowledgePage() {
  return <KnowledgeWorkspace />;
}
