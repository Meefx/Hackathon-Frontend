import { RunDetail } from "@/features/runs/components/run-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <RunDetail key={runId} runId={runId} />;
}
