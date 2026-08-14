import { db } from "@peated/server/db";
import type { bottleChecks, bottleOperations } from "@peated/server/db/schema";
import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { isSupportedBottleCheckSchemaVersion } from "@peated/server/lib/bottleCheckSchemaVersion";
import { listActionableBottleChecks } from "@peated/server/lib/bottleChecks";
import type { ModerationTaskSummary } from "@peated/server/orpc/routes/admin/moderation/schemas";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

const MAX_PROJECTED_SOURCE_ROWS = 10_000;

function listingQuestion(proposalType: string): string {
  switch (proposalType) {
    case "match_existing":
      return "Which Bottle should this listing use?";
    case "create_new":
      return "Should this Bottle be added to the catalog?";
    case "correction":
      return "Should this Bottle record be corrected?";
    default:
      return "How should this listing be resolved?";
  }
}

function operationCopy(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): {
  question: string;
  title: string;
} {
  switch (proposal.type) {
    case "update_bottle":
      return {
        question: "Apply these changes to the Bottle?",
        title: `Update Bottle #${proposal.input.bottleId}`,
      };
    case "merge_bottles":
      return {
        question: "Merge these Bottle records?",
        title: `Merge Bottle #${proposal.input.sourceBottleId} into #${proposal.input.destinationBottleId}`,
      };
    case "update_entity":
      return {
        question: "Apply these changes to the Entity?",
        title: `Update Entity #${proposal.input.entityId}`,
      };
    case "merge_entities":
      return {
        question: "Merge these Entity records?",
        title: `Merge Entity #${proposal.input.sourceEntityId} into #${proposal.input.destinationEntityId}`,
      };
  }
}

function checkSourceLabel(check: typeof bottleChecks.$inferSelect): string {
  if (check.intent === "audit_bottle") {
    return check.origin === "moderator" ? "Moderator audit" : "Catalog audit";
  }
  if (check.sourceKind === "store_price") return "Incoming listing follow-up";
  if (check.sourceKind === "photo_identification")
    return "Photo identification";
  return "Bottle check";
}

function persistedFindings(
  check: typeof bottleChecks.$inferSelect,
): unknown[] | null {
  if (!isSupportedBottleCheckSchemaVersion(check) || check.output === null) {
    return null;
  }
  const findings = check.output.findings;
  return Array.isArray(findings) ? findings : [];
}

async function listingTasks(): Promise<ModerationTaskSummary[]> {
  const rows = await db
    .select({
      proposal: storePriceMatchProposals,
      price: storePrices,
      site: externalSites,
    })
    .from(storePriceMatchProposals)
    .innerJoin(
      storePrices,
      eq(storePrices.id, storePriceMatchProposals.priceId),
    )
    .innerJoin(externalSites, eq(externalSites.id, storePrices.externalSiteId))
    .where(
      and(
        eq(storePrices.hidden, false),
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

  return rows.map(({ proposal, price, site }) => ({
    key: `listing:${proposal.id}`,
    kind: "listing",
    category: "listing",
    state: proposal.status === "errored" ? "blocked" : "ready",
    title: price.name,
    sourceLabel: site.name,
    question: listingQuestion(proposal.proposalType),
    statusLabel:
      proposal.status === "errored"
        ? "Needs recovery"
        : proposal.proposalType.replaceAll("_", " "),
    attentionAt: (proposal.enteredQueueAt ?? proposal.createdAt).toISOString(),
    source: { kind: "listing", proposalId: proposal.id },
  }));
}

async function catalogTasks(): Promise<ModerationTaskSummary[]> {
  const checks: Awaited<
    ReturnType<typeof listActionableBottleChecks>
  >["results"] = [];
  for (let cursor = 1; checks.length < MAX_PROJECTED_SOURCE_ROWS; cursor += 1) {
    const page = await listActionableBottleChecks({ cursor, limit: 100 });
    checks.push(...page.results);
    if (page.rel.nextCursor === null) break;
  }

  return checks.flatMap((check) => {
    const operationalStatuses = new Set(["applying", "stale", "failed"]);
    if (
      check.operations.some(({ status }) => operationalStatuses.has(status))
    ) {
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

    const findings = persistedFindings(check);
    if (findings === null || findings.length > 0) {
      const subject = check.bottleId
        ? `Bottle #${check.bottleId}`
        : `Check #${check.id}`;
      return [
        {
          key: `finding:${check.id}`,
          kind: "finding" as const,
          category: "catalog" as const,
          state: findings === null ? ("blocked" as const) : ("ready" as const),
          title: subject,
          sourceLabel: checkSourceLabel(check),
          question:
            findings === null
              ? "How should this unavailable check be resolved?"
              : "Have these catalog findings been resolved?",
          statusLabel:
            findings === null
              ? "Unsupported check version"
              : `${findings.length} ${findings.length === 1 ? "finding" : "findings"}`,
          attentionAt: (check.completedAt ?? check.createdAt).toISOString(),
          source: { kind: "finding" as const, checkId: check.id },
        },
      ];
    }
    return [];
  });
}

export async function projectModerationTasks(): Promise<
  ModerationTaskSummary[]
> {
  const tasks = [...(await listingTasks()), ...(await catalogTasks())];
  return tasks.sort(
    (left, right) =>
      left.attentionAt.localeCompare(right.attentionAt) ||
      left.key.localeCompare(right.key),
  );
}

export function filterModerationTasks(
  tasks: ModerationTaskSummary[],
  input: {
    query?: string;
    category?: "listing" | "catalog";
    blocked?: boolean;
  },
): ModerationTaskSummary[] {
  const query = input.query?.toLocaleLowerCase();
  return tasks.filter((task) => {
    if (input.category && task.category !== input.category) return false;
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
