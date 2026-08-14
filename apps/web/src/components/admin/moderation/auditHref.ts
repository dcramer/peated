import type { Outputs } from "@peated/server/orpc/router";

type Audit = Outputs["audits"]["details"]["audit"];

export function moderationHrefForAudit(audit: Audit): string {
  if (!audit.schemaSupported) return "/admin/moderation/automation";

  const decision = audit.operations.find(({ status }) =>
    ["pending_review", "blocked"].includes(status),
  );
  if (decision) {
    return `/admin/moderation/inbox/operation/${decision.id}`;
  }

  if (
    audit.operations.length === 0 &&
    !audit.closedAt &&
    audit.output.findings.length > 0
  ) {
    return `/admin/moderation/inbox/finding/${audit.id}`;
  }

  if (
    audit.operations.some(({ status }) =>
      ["applying", "stale", "failed"].includes(status),
    )
  ) {
    return "/admin/moderation/automation";
  }

  return "/admin/moderation/history?category=catalog";
}
