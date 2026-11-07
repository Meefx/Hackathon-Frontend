import type { RunActivityState, RunSnapshot, RuntimeActivityEvent } from "./types";

export type ActivityStatus = "working" | "waiting" | "completed" | "failed" | "cancelled" | "blocked" | "interrupted" | "unknown";
export interface ActivityNode {
  id: string;
  parentId: string | null;
  name: string;
  status: ActivityStatus;
  lastEvent: string;
  recordedAt: string | null;
  tools: string[];
  note: string;
}
export const activityStatusLabels: Record<ActivityStatus, string> = {
  working: "Working", waiting: "Waiting", completed: "Completed",
  failed: "Failed", cancelled: "Cancelled", blocked: "Blocked", interrupted: "Interrupted", unknown: "Unknown",
};
function statusFor(value: string): ActivityStatus {
  if (value === "queued" || value === "pending") return "waiting";
  if (value === "running") return "working";
  if (value === "completed" || value === "failed" || value === "cancelled" || value === "blocked" || value === "interrupted") return value;
  return "unknown";
}
function compactId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export function buildActivityNodes(run: RunSnapshot, activity: RunActivityState): ActivityNode[] {
  const manager: ActivityNode = {
    id: "manager", parentId: null, name: "Manager", status: statusFor(run.status),
    lastEvent: `Run ${run.status}`, recordedAt: run.finished_at || run.started_at || run.created_at,
    tools: [], note: run.status === "interrupted" ? "Run interrupted" : run.status === "blocked" ? "Run blocked" : "",
  };
  const active = run.status === "queued" || run.status === "running";
  if (run.actual_runtime_mode === "simulated") {
    return [manager, ...[...run.steps].sort((a, b) => a.sequence - b.sequence).map(step => ({
      id: `step-${step.id}`, parentId: "manager", name: `${step.role.charAt(0).toUpperCase()}${step.role.slice(1)} step`,
      status: !active && statusFor(step.status) === "working" ? "unknown" : statusFor(step.status), lastEvent: step.summary,
      recordedAt: step.finished_at || step.started_at || null, tools: [], note: "Persisted simulated step",
    }))];
  }
  const nodes = new Map<string, ActivityNode>([[manager.id, manager]]);
  const tools = new Map<string, Map<string, string>>();
  for (const event of activity.events) {
    let node = nodes.get(event.agent_id);
    if (!node) {
      node = { id: event.agent_id, parentId: event.parent_agent_id, name: `Subagent ${compactId(event.agent_id)}`,
        status: "unknown", lastEvent: "No event recorded", recordedAt: null, tools: [], note: "" };
      nodes.set(node.id, node);
    }
    if (event.parent_agent_id) node.parentId = event.parent_agent_id;
    node.lastEvent = event.type;
    node.recordedAt = event.created_at;
    if (node.id !== "manager") updateChildStatus(node, event);
    const agentTools = tools.get(node.id) || new Map<string, string>();
    const toolKey = event.tool_call_id || event.tool_name;
    if (toolKey && event.tool_name && event.type === "tool.started") agentTools.set(toolKey, event.tool_name);
    if (toolKey && event.type === "tool.completed") agentTools.delete(toolKey);
    tools.set(node.id, agentTools);
  }
  const verified = activity.status === "available" && !activity.error && !activity.truncated;
  for (const node of nodes.values()) {
    node.tools = active && verified && node.status === "working" ? Array.from(tools.get(node.id)?.values() || []) : [];
    if (node.id !== "manager" && node.status === "working" && (!active || !verified)) {
      node.status = "unknown";
      node.note = "No longer confirmed active. Last confirmed evidence is retained.";
    }
    if (node.id !== "manager" && !validParent(node, nodes)) {
      node.parentId = null;
      node.note = "Parent relationship unverified";
    }
  }
  return Array.from(nodes.values());
}
function updateChildStatus(node: ActivityNode, event: RuntimeActivityEvent) {
  if (event.type === "subagent.start") node.status = "working";
  if (event.type === "subagent.complete") node.status = event.status ? statusFor(event.status) : "unknown";
}
function validParent(node: ActivityNode, nodes: Map<string, ActivityNode>) {
  const seen = new Set([node.id]);
  let parent = node.parentId;
  while (parent) {
    if (seen.has(parent) || !nodes.has(parent)) return false;
    seen.add(parent);
    parent = nodes.get(parent)!.parentId;
  }
  return node.parentId !== null;
}
