import { db } from "@peated/server/db";
import {
  actors,
  bottleChecks,
  bottleOperations,
  incomingBottleDecisionLogs,
  users,
} from "@peated/server/db/schema";
import type { ModerationHistorySummary } from "@peated/server/orpc/routes/admin/moderation/schemas";
import { desc, eq, isNotNull } from "drizzle-orm";

const MAX_PROJECTED_HISTORY_ROWS = 10_000;

function operationTitle(
  proposal: (typeof bottleOperations.$inferSelect)["proposal"],
): string {
  switch (proposal.type) {
    case "update_bottle":
      return `Update Bottle #${proposal.input.bottleId}`;
    case "merge_bottles":
      return `Merge Bottle #${proposal.input.sourceBottleId} into #${proposal.input.destinationBottleId}`;
    case "update_entity":
      return `Update Entity #${proposal.input.entityId}`;
    case "merge_entities":
      return `Merge Entity #${proposal.input.sourceEntityId} into #${proposal.input.destinationEntityId}`;
  }
}

export async function projectModerationHistory(): Promise<
  ModerationHistorySummary[]
> {
  const [incoming, operations, closures] = await Promise.all([
    db
      .select({ log: incomingBottleDecisionLogs, actor: actors.displayName })
      .from(incomingBottleDecisionLogs)
      .innerJoin(actors, eq(actors.id, incomingBottleDecisionLogs.actorId))
      .orderBy(
        desc(incomingBottleDecisionLogs.createdAt),
        desc(incomingBottleDecisionLogs.id),
      )
      .limit(MAX_PROJECTED_HISTORY_ROWS),
    db
      .select({ operation: bottleOperations, actor: users.username })
      .from(bottleOperations)
      .leftJoin(users, eq(users.id, bottleOperations.reviewedById))
      .where(isNotNull(bottleOperations.reviewedAt))
      .orderBy(desc(bottleOperations.reviewedAt), desc(bottleOperations.id))
      .limit(MAX_PROJECTED_HISTORY_ROWS),
    db
      .select({ check: bottleChecks, actor: users.username })
      .from(bottleChecks)
      .leftJoin(users, eq(users.id, bottleChecks.closedById))
      .where(isNotNull(bottleChecks.closedAt))
      .orderBy(desc(bottleChecks.closedAt), desc(bottleChecks.id))
      .limit(MAX_PROJECTED_HISTORY_ROWS),
  ]);

  return [
    ...incoming.map(
      ({ log, actor }): ModerationHistorySummary => ({
        key: `incoming:${log.id}`,
        kind: "incoming_decision",
        category: "listing",
        title: log.name,
        outcome: log.decision.replaceAll("_", " "),
        actor,
        occurredAt: log.createdAt.toISOString(),
      }),
    ),
    ...operations.map(
      ({ operation, actor }): ModerationHistorySummary => ({
        key: `operation:${operation.id}`,
        kind: "operation",
        category: "catalog",
        title: operationTitle(operation.proposal),
        outcome: operation.status.replaceAll("_", " "),
        actor,
        occurredAt: operation.reviewedAt!.toISOString(),
      }),
    ),
    ...closures.map(
      ({ check, actor }): ModerationHistorySummary => ({
        key: `closure:${check.id}`,
        kind: "audit_closure",
        category: "catalog",
        title: check.bottleId
          ? `Bottle #${check.bottleId}`
          : `Check #${check.id}`,
        outcome: check.closeReason?.replaceAll("_", " ") ?? "closed",
        actor,
        occurredAt: check.closedAt!.toISOString(),
      }),
    ),
  ].sort(
    (left, right) =>
      right.occurredAt.localeCompare(left.occurredAt) ||
      left.key.localeCompare(right.key),
  );
}

export function filterModerationHistory(
  events: ModerationHistorySummary[],
  input: {
    query?: string;
    category?: "listing" | "catalog";
    outcome?: string;
    actor?: string;
  },
): ModerationHistorySummary[] {
  const query = input.query?.toLocaleLowerCase();
  const outcome = input.outcome?.toLocaleLowerCase();
  const actor = input.actor?.toLocaleLowerCase();
  return events.filter((event) => {
    if (input.category && event.category !== input.category) return false;
    if (outcome && !event.outcome.toLocaleLowerCase().includes(outcome)) {
      return false;
    }
    if (actor && !event.actor?.toLocaleLowerCase().includes(actor))
      return false;
    if (
      query &&
      ![event.title, event.outcome, event.actor, event.key]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });
}
