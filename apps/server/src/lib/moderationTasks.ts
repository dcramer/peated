// Inbox tasks are narrow projections of source-owned decisions. This module
// must not load full listing or audit detail while listing or locating them.
import { db } from "@peated/server/db";
import {
  bottleOperations,
  externalSites,
  reports,
  storePriceMatchProposals,
  storePrices,
  users,
} from "@peated/server/db/schema";
import {
  getActionableBottleCheckSummary,
  listActionableBottleCheckSummaries,
  type ActionableBottleCheckSummary,
} from "@peated/server/lib/bottleChecks";
import { isSupportedBottleCheckSchemaVersion } from "@peated/server/lib/bottleCheckSchemaVersion";
import {
  CATALOG_REPORT_OBJECT_TYPES,
  describeReportSubject,
  loadReportTargets,
  recordNameOf,
  reportTargetKey,
} from "@peated/server/lib/reports";
import { currentStorePriceCondition } from "@peated/server/lib/storePriceValidity";
import type { ModerationTaskSummary } from "@peated/server/orpc/routes/admin/moderation/schemas";
import { REPORT_REASON_LABELS } from "@peated/server/schemas/reports";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

const MAX_PROJECTED_SOURCE_ROWS = 10_000;
const OPERATIONAL_STATUSES = new Set(["applying", "stale", "failed"]);

function listingQuestion(proposalType: string): string {
  switch (proposalType) {
    case "match_existing":
      return "Which bottle should this listing use?";
    case "create_new":
      return "Should this bottle be added to the catalog?";
    case "correction":
      return "Should this bottle be corrected?";
    case "no_match":
      return "No bottle match was found. Should this listing be ignored?";
    default:
      return "How should this listing be resolved?";
  }
}

interface OperationCopy {
  question: string;
  title: string;
}

function operationCopy(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): OperationCopy {
  switch (proposal.type) {
    case "update_bottle":
      return {
        question: "Apply these changes to the bottle?",
        title: `Update bottle #${proposal.input.bottleId}`,
      };
    case "merge_bottles":
      return {
        question: "Merge these bottles?",
        title: `Merge bottle #${proposal.input.sourceBottleId} into #${proposal.input.destinationBottleId}`,
      };
    case "update_entity":
      return {
        question: "Apply these changes to the brand or producer?",
        title: `Update brand or producer #${proposal.input.entityId}`,
      };
    case "merge_entities":
      return {
        question: "Merge these brands or producers?",
        title: `Merge brand or producer #${proposal.input.sourceEntityId} into #${proposal.input.destinationEntityId}`,
      };
  }
}

function checkSourceLabel(check: ActionableBottleCheckSummary): string {
  if (check.intent === "audit_bottle") {
    return check.origin === "moderator" ? "Moderator audit" : "Catalog audit";
  }
  if (check.sourceKind === "store_price") return "Incoming listing follow-up";
  if (check.sourceKind === "photo_identification")
    return "Photo identification";
  return "Catalog review";
}

function persistedFindingCount(
  check: ActionableBottleCheckSummary,
): number | null {
  if (!isSupportedBottleCheckSchemaVersion(check) || !check.hasOutput) {
    return null;
  }
  return check.findingCount;
}

type ListingTaskRow = {
  proposal: Pick<
    typeof storePriceMatchProposals.$inferSelect,
    "createdAt" | "enteredQueueAt" | "id" | "proposalType" | "status"
  >;
  price: Pick<typeof storePrices.$inferSelect, "name">;
  site: Pick<typeof externalSites.$inferSelect, "name">;
};

function listingTask({
  proposal,
  price,
  site,
}: ListingTaskRow): ModerationTaskSummary {
  return {
    key: `listing:${proposal.id}`,
    kind: "listing",
    category: "listing",
    state: proposal.status === "errored" ? "blocked" : "ready",
    inconclusive:
      proposal.status === "pending_review" &&
      proposal.proposalType === "no_match",
    title: price.name,
    sourceLabel: site.name,
    question: listingQuestion(proposal.proposalType),
    statusLabel:
      proposal.status === "errored"
        ? "Needs recovery"
        : proposal.proposalType === "no_match"
          ? "Inconclusive"
          : proposal.proposalType.replaceAll("_", " "),
    attentionAt: (proposal.enteredQueueAt ?? proposal.createdAt).toISOString(),
    source: { kind: "listing", proposalId: proposal.id },
  };
}

async function listingTasks(
  proposalId?: number,
): Promise<ModerationTaskSummary[]> {
  const rows = await db
    .select({
      proposal: {
        createdAt: storePriceMatchProposals.createdAt,
        enteredQueueAt: storePriceMatchProposals.enteredQueueAt,
        id: storePriceMatchProposals.id,
        proposalType: storePriceMatchProposals.proposalType,
        status: storePriceMatchProposals.status,
      },
      price: { name: storePrices.name },
      site: { name: externalSites.name },
    })
    .from(storePriceMatchProposals)
    .innerJoin(
      storePrices,
      eq(storePrices.id, storePriceMatchProposals.priceId),
    )
    .innerJoin(externalSites, eq(externalSites.id, storePrices.externalSiteId))
    .where(
      and(
        proposalId === undefined
          ? undefined
          : eq(storePriceMatchProposals.id, proposalId),
        eq(storePrices.hidden, false),
        // Store price matching owns this rule: the Inbox lists only listings
        // the store still shows. A direct link to one task still opens it.
        proposalId === undefined ? currentStorePriceCondition() : undefined,
        inArray(storePriceMatchProposals.status, ["pending_review", "errored"]),
        or(
          isNull(storePriceMatchProposals.processingExpiresAt),
          lte(storePriceMatchProposals.processingExpiresAt, new Date()),
        ),
      ),
    )
    .orderBy(
      asc(storePriceMatchProposals.enteredQueueAt),
      asc(storePriceMatchProposals.createdAt),
      asc(storePriceMatchProposals.id),
    )
    .limit(MAX_PROJECTED_SOURCE_ROWS);

  return rows.map(listingTask);
}

function catalogTasksForCheck(
  check: ActionableBottleCheckSummary,
): ModerationTaskSummary[] {
  if (check.operations.some(({ status }) => OPERATIONAL_STATUSES.has(status))) {
    return [];
  }

  const operations = check.operations.filter(
    ({ status }) => status === "pending_review" || status === "blocked",
  );
  if (operations.length > 0) {
    return operations.map((operation): ModerationTaskSummary => {
      const copy = operationCopy(operation.proposal);
      return {
        key: `operation:${operation.id}`,
        kind: "operation",
        category: "catalog",
        state: operation.status === "blocked" ? "blocked" : "ready",
        inconclusive: false,
        title: copy.title,
        sourceLabel: checkSourceLabel(check),
        question: copy.question,
        statusLabel:
          operation.status === "blocked" ? "Blocked" : "Suggested change",
        attentionAt: operation.createdAt.toISOString(),
        source: {
          kind: "operation",
          checkId: check.id,
          operationId: operation.id,
        },
      };
    });
  }

  const findingCount = persistedFindingCount(check);
  if (findingCount === null || findingCount > 0) {
    const subject = check.bottleId
      ? `Bottle #${check.bottleId}`
      : `Check #${check.id}`;
    return [
      {
        key: `finding:${check.id}`,
        kind: "finding" as const,
        category: "catalog" as const,
        state:
          findingCount === null ? ("blocked" as const) : ("ready" as const),
        inconclusive: false,
        title: subject,
        sourceLabel: checkSourceLabel(check),
        question:
          findingCount === null
            ? "How should this unavailable check be resolved?"
            : "Have these catalog findings been resolved?",
        statusLabel:
          findingCount === null
            ? "Unsupported check version"
            : `${findingCount} ${findingCount === 1 ? "finding" : "findings"}`,
        attentionAt: (check.completedAt ?? check.createdAt).toISOString(),
        source: { kind: "finding" as const, checkId: check.id },
      },
    ];
  }
  return [];
}

type ReportTaskRow = {
  report: Pick<
    typeof reports.$inferSelect,
    "createdAt" | "id" | "objectId" | "objectType" | "reason"
  >;
  reportedUser: Pick<typeof users.$inferSelect, "username"> | null;
};

function reportTask(
  { report, reportedUser }: ReportTaskRow,
  recordName: string | null,
): ModerationTaskSummary {
  return {
    key: `report:${report.id}`,
    kind: "report",
    category: "community",
    state: "ready",
    inconclusive: false,
    title: describeReportSubject({
      objectType: report.objectType,
      objectId: report.objectId,
      reportedUsername: reportedUser?.username ?? null,
      recordName,
    }),
    sourceLabel: "Member report",
    question:
      report.objectType === "user"
        ? "Does this member break the rules?"
        : "Does this content break the rules?",
    statusLabel: REPORT_REASON_LABELS[report.reason],
    attentionAt: report.createdAt.toISOString(),
    source: { kind: "report", reportId: report.id },
  };
}

async function reportTasks(
  reportId?: number,
): Promise<ModerationTaskSummary[]> {
  const rows = await db
    .select({
      report: {
        createdAt: reports.createdAt,
        id: reports.id,
        objectId: reports.objectId,
        objectType: reports.objectType,
        reason: reports.reason,
      },
      reportedUser: { username: users.username },
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reportedUserId))
    .where(
      and(
        reportId === undefined ? undefined : eq(reports.id, reportId),
        eq(reports.status, "open"),
      ),
    )
    .orderBy(asc(reports.createdAt), asc(reports.id))
    .limit(MAX_PROJECTED_SOURCE_ROWS);
  // Catalog reports are titled by the record's current name, not a member.
  const catalogTargets = await loadReportTargets(
    db,
    rows
      .map(({ report }) => report)
      .filter((report) => CATALOG_REPORT_OBJECT_TYPES.has(report.objectType)),
  );
  return rows.map((row) =>
    reportTask(
      row,
      recordNameOf(
        row.report.objectType,
        catalogTargets.get(reportTargetKey(row.report))?.contentPreview ?? null,
      ),
    ),
  );
}

async function catalogTasks(): Promise<ModerationTaskSummary[]> {
  const checks = await listActionableBottleCheckSummaries(
    MAX_PROJECTED_SOURCE_ROWS,
  );
  return checks.flatMap(catalogTasksForCheck);
}

export async function projectModerationTasks(): Promise<
  ModerationTaskSummary[]
> {
  const [listings, catalog, reportList] = await Promise.all([
    listingTasks(),
    catalogTasks(),
    reportTasks(),
  ]);
  const tasks = [...listings, ...catalog, ...reportList];
  return tasks.sort(
    (left, right) =>
      left.attentionAt.localeCompare(right.attentionAt) ||
      left.key.localeCompare(right.key),
  );
}

export async function locateModerationTask(
  key: string,
): Promise<ModerationTaskSummary | null> {
  const [kind, rawId] = key.split(":");
  const id = Number(rawId);
  if (kind === "listing") return (await listingTasks(id)).at(0) ?? null;
  if (kind === "report") return (await reportTasks(id)).at(0) ?? null;

  const checkId =
    kind === "finding"
      ? id
      : kind === "operation"
        ? (
            await db.query.bottleOperations.findFirst({
              columns: { checkId: true },
              where: eq(bottleOperations.id, id),
            })
          )?.checkId
        : undefined;
  if (checkId === undefined) return null;

  const check = await getActionableBottleCheckSummary(checkId);
  return check
    ? (catalogTasksForCheck(check).find((task) => task.key === key) ?? null)
    : null;
}

export function filterModerationTasks(
  tasks: ModerationTaskSummary[],
  input: {
    query?: string;
    category?: "listing" | "catalog" | "community";
    blocked?: boolean;
    inconclusive?: boolean;
  },
): ModerationTaskSummary[] {
  const query = input.query?.toLocaleLowerCase();
  return tasks.filter((task) => {
    if (input.category && task.category !== input.category) return false;
    if (
      input.inconclusive !== undefined &&
      task.inconclusive !== input.inconclusive
    ) {
      return false;
    }
    if (
      input.blocked !== undefined &&
      (task.state === "blocked") !== input.blocked
    ) {
      return false;
    }
    if (
      query &&
      ![task.title, task.sourceLabel, task.question, task.statusLabel, task.key]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
}
