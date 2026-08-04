import type { Finding } from "@peated/bottle-classifier";
import type { Outputs } from "@peated/server/orpc/router";
import Link from "@peated/web/components/link";

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
        className="font-medium text-white underline"
        href={`/bottles/${check.bottleId}`}
      >
        Bottle #{check.bottleId}
      </Link>
    );
  }
  if (check.intent === "resolve_reference") {
    return (
      <span className="text-slate-300">
        {check.sourceKind === "store_price"
          ? "Store price"
          : "Bottle reference"}
        {check.sourceId ? ` #${check.sourceId}` : ""}
      </span>
    );
  }
  return <span className="text-slate-300">Deleted Bottle</span>;
}

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
