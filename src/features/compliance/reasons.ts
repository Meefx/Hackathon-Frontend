const labels: Record<string, string> = {
  policy_missing: "Contact policy is missing",
  holiday_coverage_missing: "Holiday calendar coverage is missing",
  outside_contact_window: "Outside the permitted contact window",
  recipient_unverified: "Recipient is not verified",
  case_paused: "Case contact is paused",
  frequency_limit: "Contact frequency limit reached",
  guardrail_rejected: "Candidate rejected by compliance",
  approval_expired: "Approval has expired",
  approval_invalid: "Approval is invalid",
  policy_changed: "Policy changed; approval must be renewed",
  guardrail_unavailable: "Policy classifier is unavailable",
  knowledge_unavailable: "Required knowledge is unavailable",
  no_approved_context: "No approved knowledge context",
  knowledge_reference_invalid: "Knowledge reference is invalid or revoked",
  runtime_unavailable: "Runtime is unavailable",
  runtime_interrupted: "Runtime was interrupted",
  result_invalid: "Runtime result did not pass validation",
  channel_unavailable: "Channel is unavailable",
  version_conflict: "This record changed. Refresh before a new action.",
};
export function reasonLabel(code: string) {
  return labels[code] || code.replaceAll("_", " ");
}
