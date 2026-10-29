import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleChecks,
  bottles,
  entities,
  entityTombstones,
} from "@peated/server/db/schema";
import { activeBottleWhere } from "@peated/server/lib/activeBottles";
import {
  getActionableBottleCheckSummary,
  listActionableBottleCheckSummaries,
  type ActionableBottleCheckSummary,
} from "@peated/server/lib/bottleChecks";
import { isSupportedBottleCheck } from "@peated/server/lib/bottleCheckSchemaVersion";
import { logInfo } from "@peated/server/lib/log";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

const MAX_CHECKS_PER_RUN = 10_000;
const OPEN_OPERATION_STATUSES = new Set(["pending_review", "blocked"]);
// Work that is applying, stale, or failed belongs to Background work.
const RUNNING_OPERATION_STATUSES = new Set(["applying", "stale", "failed"]);

const CLOSE_NOTES = {
  unsupported:
    "Closed automatically: its saved changes use an older format that can no longer be reviewed.",
  subject_removed:
    "Closed automatically: the bottles or brands it refers to were merged or deleted.",
} as const;

export type UnactionableReason = keyof typeof CLOSE_NOTES;

type LiveTargets = { bottleIds: Set<number>; entityIds: Set<number> };

type Operation = ActionableBottleCheckSummary["operations"][number];

function operationTargets({ proposal }: Operation) {
  switch (proposal.type) {
    case "update_bottle":
      return { bottleIds: [proposal.input.bottleId], entityIds: [] };
    case "merge_bottles":
      return {
        bottleIds: [
          proposal.input.sourceBottleId,
          proposal.input.destinationBottleId,
        ],
        entityIds: [],
      };
    case "update_entity":
      return { bottleIds: [], entityIds: [proposal.input.entityId] };
    case "merge_entities":
      return {
        bottleIds: [],
        entityIds: [
          proposal.input.sourceEntityId,
          proposal.input.destinationEntityId,
        ],
      };
  }
}

/**
 * Catalog moderation owns this rule: close a check only when nothing in it can
 * still be acted on. A change whose targets all exist, or findings about a
 * Bottle that still exists, keep the check open for a moderator.
 */
export function unactionableReason(
  check: ActionableBottleCheckSummary,
  live: LiveTargets,
): UnactionableReason | null {
  if (
    check.operations.some(({ status }) =>
      RUNNING_OPERATION_STATUSES.has(status),
    )
  ) {
    return null;
  }
  if (!isSupportedBottleCheck(check)) return "unsupported";

  const hasLiveOperation = check.operations.some((operation) => {
    if (!OPEN_OPERATION_STATUSES.has(operation.status)) return false;
    const targets = operationTargets(operation);
    return (
      targets.bottleIds.every((id) => live.bottleIds.has(id)) &&
      targets.entityIds.every((id) => live.entityIds.has(id))
    );
  });
  if (hasLiveOperation) return null;

  // Only a Bottle audit's findings are about its Bottle. Findings on listing
  // or photo checks stay open whatever their Bottle link says.
  const bottleRemoved =
    check.intent === "audit_bottle" &&
    (check.bottleId === null || !live.bottleIds.has(check.bottleId));
  if (check.findingCount > 0 && !bottleRemoved) return null;

  return "subject_removed";
}

async function loadLiveTargets(
  checks: ActionableBottleCheckSummary[],
  database: AnyDatabase,
): Promise<LiveTargets> {
  const bottleIds = new Set<number>();
  const entityIds = new Set<number>();
  for (const check of checks) {
    if (check.bottleId !== null) bottleIds.add(check.bottleId);
    if (!isSupportedBottleCheck(check)) continue;
    for (const operation of check.operations) {
      const targets = operationTargets(operation);
      targets.bottleIds.forEach((id) => bottleIds.add(id));
      targets.entityIds.forEach((id) => entityIds.add(id));
    }
  }
  const [liveBottles, liveEntities] = await Promise.all([
    bottleIds.size
      ? database
          .select({ id: bottles.id })
          .from(bottles)
          .where(and(inArray(bottles.id, [...bottleIds]), activeBottleWhere()))
      : [],
    entityIds.size
      ? database
          .select({ id: entities.id })
          .from(entities)
          .where(
            and(
              inArray(entities.id, [...entityIds]),
              notInArray(
                entities.id,
                database
                  .select({ id: entityTombstones.entityId })
                  .from(entityTombstones),
              ),
            ),
          )
      : [],
  ]);
  return {
    bottleIds: new Set(liveBottles.map(({ id }) => id)),
    entityIds: new Set(liveEntities.map(({ id }) => id)),
  };
}

async function closeIfUnactionable(checkId: number): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Lock the check, then decide again from current data, so a moderator's
    // approval or close in the meantime wins.
    const [locked] = await tx
      .select({ id: bottleChecks.id })
      .from(bottleChecks)
      .where(and(eq(bottleChecks.id, checkId), isNull(bottleChecks.closedAt)))
      .for("update");
    if (!locked) return false;
    const check = await getActionableBottleCheckSummary(checkId, tx);
    if (!check) return false;
    const reason = unactionableReason(
      check,
      await loadLiveTargets([check], tx),
    );
    if (!reason) return false;
    await tx
      .update(bottleChecks)
      .set({
        closedAt: sql`NOW()`,
        closedById: null,
        closeReason: "no_longer_actionable",
        closeNote: CLOSE_NOTES[reason],
      })
      .where(eq(bottleChecks.id, checkId));
    return true;
  });
}

/** Closes open Inbox checks that no longer have anything to act on. */
export async function closeUnactionableBottleChecks(): Promise<number> {
  const checks = await listActionableBottleCheckSummaries(MAX_CHECKS_PER_RUN);
  const live = await loadLiveTargets(checks, db);
  let closed = 0;
  for (const check of checks) {
    if (!unactionableReason(check, live)) continue;
    if (await closeIfUnactionable(check.id)) closed += 1;
  }
  if (closed) {
    logInfo("Closed {count} catalog checks with nothing left to act on", {
      extra: { count: closed },
    });
  }
  return closed;
}
