import type { Finding } from "@peated/bottle-classifier";
import type { Outputs } from "@peated/server/orpc/router";
import { AppLink as Link } from "@peated/web/components";
import * as stylex from "@stylexjs/stylex";
import { colors, effects } from "../../styles/tokens.stylex";

export type BottleCheck = Outputs["audits"]["list"]["results"][number];

export function getBottleCheckFindings(check: BottleCheck): Finding[] {
  return check.schemaSupported ? check.output.findings : [];
}

export function getBottleCheckSummary(check: BottleCheck): string {
  if (!check.schemaSupported) {
    return `This audit uses unsupported schema version ${check.schemaVersion}.`;
  }
  if (check.intent === "audit_bottle") return check.output.summary;
  if (check.output.status === "ignored") return check.output.reason;
  return (
    check.output.decision.rationale ?? check.error ?? "Audit needs review."
  );
}

const UNRESOLVED_OPERATION_STATUSES = new Set([
  "blocked",
  "pending_review",
  "applying",
  "stale",
  "failed",
]);

export function getBottleCheckOperationCount(
  check: BottleCheck,
  { unresolvedOnly = false }: { unresolvedOnly?: boolean } = {},
): number {
  if (!check.schemaSupported) return check.operationCount;
  if (!unresolvedOnly) return check.operations.length;
  return check.operations.filter(({ status }) =>
    UNRESOLVED_OPERATION_STATUSES.has(status),
  ).length;
}

export function getBottleCheckState(check: BottleCheck): string {
  if (check.closedAt) {
    if (check.closeReason === "resolved_manually") return "Resolved manually";
    if (check.closeReason === "dismissed") return "Dismissed";
    return "Closed";
  }
  if (!check.schemaSupported) return "Unsupported schema";
  const findings = getBottleCheckFindings(check);
  const statuses = new Set(
    check.operations.map((operation) => operation.status),
  );
  if (statuses.has("applying")) return "Applying";
  if (statuses.has("failed")) return "Failed";
  if (statuses.has("stale")) return "Stale";
  if (statuses.has("pending_review")) return "Approval needed";
  if (statuses.has("blocked")) return "Blocked";
  if (findings.length > 0) return "Findings";
  if (check.operations.length === 0) return "Clean";
  return "Complete";
}

export function BottleCheckSubject({
  check,
}: {
  check: Pick<BottleCheck, "bottleId" | "intent" | "sourceId" | "sourceKind">;
}) {
  if (check.bottleId) {
    return (
      <Link
        href={`/bottles/${check.bottleId}`}
        {...stylex.props(styles.subjectLink)}
      >
        Bottle #{check.bottleId}
      </Link>
    );
  }
  if (check.intent === "resolve_reference") {
    return (
      <span {...stylex.props(styles.subject)}>
        {check.sourceKind === "store_price"
          ? "Incoming listing"
          : "Bottle reference"}
        {check.sourceId ? ` #${check.sourceId}` : ""}
      </span>
    );
  }
  return <span {...stylex.props(styles.subject)}>Deleted Bottle</span>;
}

const styles = stylex.create({
  subject: { color: colors.inkMuted },
  subjectLink: {
    color: { default: colors.ink, ":hover": colors.accentDeep },
    fontWeight: 600,
    textDecoration: "underline",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});

export function BottleCheckOrigin({
  check,
}: {
  check: Pick<BottleCheck, "intent" | "origin">;
}) {
  if (check.intent !== "audit_bottle") return null;
  return (
    <span>
      {check.origin === "post_user_creation"
        ? "Post-create audit"
        : "Moderator audit"}
    </span>
  );
}
