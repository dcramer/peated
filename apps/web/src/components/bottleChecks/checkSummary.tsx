import type { Outputs } from "@peated/server/orpc/router";
import Link from "@peated/web/components/link";

export type BottleCheck = Outputs["bottleChecks"]["list"]["results"][number];

type Finding = {
  evidenceRefs?: unknown;
  scope?: unknown;
  summary?: unknown;
};

export function getBottleCheckFindings(check: BottleCheck): Finding[] {
  const findings = check.output?.findings;
  return Array.isArray(findings)
    ? findings.filter(
        (finding): finding is Finding =>
          typeof finding === "object" && finding !== null,
      )
    : [];
}

export function getBottleCheckSummary(check: BottleCheck): string {
  if (typeof check.output?.summary === "string") return check.output.summary;
  if (typeof check.output?.reason === "string") return check.output.reason;
  const decision = check.output?.decision;
  if (
    typeof decision === "object" &&
    decision !== null &&
    "rationale" in decision &&
    typeof decision.rationale === "string"
  ) {
    return decision.rationale;
  }
  return check.error || "Bottle check needs review.";
}

export function getBottleCheckState(check: BottleCheck): string {
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
