/**
 * Moves one Bottle into another BottleGroup, so the marketed releases of one
 * expression share a group (Whisky Identity Model, "BottleGroup Versus
 * BottleSeries"). The Bottle takes the group's shared name and keeps its own
 * release facts. Brand, bottler, Series, category, and distillers must already
 * match, so a move never changes a Bottle's producer or range.
 */
import { db, type AnyTransaction } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleTombstones,
  changes,
  entities,
  type Bottle,
  type BottleGroup,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleIdentityConflictError,
  reserveBottleIdentitiesInTransaction,
} from "@peated/server/lib/bottleConflicts";
import { materializeBottleForGroup } from "@peated/server/lib/bottleIdentity";
import { getSameTitleProblem } from "@peated/server/lib/bottleNamingRules";
import { logError } from "@peated/server/lib/log";
import { canModerate } from "@peated/server/lib/moderators";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import type { Context } from "@peated/server/orpc/context";
import { pushJob } from "@peated/server/worker/dispatch";
import { asc, eq, inArray } from "drizzle-orm";

export type BottleGroupMoveErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict";

export class BottleGroupMoveError extends Error {
  constructor(
    readonly code: BottleGroupMoveErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BottleGroupMoveError";
  }
}

export type BottleGroupMoveResult = {
  bottle: Bottle;
  changed: boolean;
};

async function getGroupDistillerIds(tx: AnyTransaction, groupId: number) {
  const rows = await tx
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, groupId))
    .orderBy(asc(bottleGroupDistillers.distillerId));
  return rows.map(({ distillerId }) => distillerId);
}

async function loadEntity(tx: AnyTransaction, entityId: number) {
  const [entity] = await tx
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!entity) {
    throw new BottleGroupMoveError(
      "invalid",
      `Entity ${entityId} could not be resolved.`,
    );
  }
  return entity;
}

/** Names the shared fields that differ, so the caller can edit them first. */
function getSharedFieldDifferences(
  bottle: Bottle,
  group: BottleGroup,
  bottleDistillerIds: number[],
  groupDistillerIds: number[],
) {
  const differences: string[] = [];
  if (bottle.brandId !== group.brandId) differences.push("brand");
  if (bottle.bottlerId !== group.bottlerId) differences.push("bottler");
  if (bottle.seriesId !== group.seriesId) differences.push("series");
  if (bottle.category !== group.category) differences.push("category");
  if (bottleDistillerIds.join(",") !== groupDistillerIds.join(",")) {
    differences.push("distillers");
  }
  return differences;
}

export async function moveBottleToGroupInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    groupId,
    actorId,
  }: { bottleId: number; groupId: number; actorId: number },
): Promise<BottleGroupMoveResult> {
  const [discovered] = await tx
    .select({ groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  if (!discovered) {
    throw new BottleGroupMoveError(
      "not_found",
      `Bottle ${bottleId} not found.`,
    );
  }
  if (discovered.groupId === null) {
    throw new BottleGroupMoveError(
      "invalid",
      `Bottle ${bottleId} has no BottleGroup.`,
    );
  }
  const sourceGroupId = discovered.groupId;

  // Lock groups, then members, in id order, the same order Bottle merges use.
  const groupIds = Array.from(new Set([sourceGroupId, groupId])).sort(
    (left, right) => left - right,
  );
  const groups = await tx
    .select()
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, groupIds))
    .orderBy(asc(bottleGroups.id))
    .for("update");
  const members = await tx
    .select()
    .from(bottles)
    .where(inArray(bottles.groupId, groupIds))
    .orderBy(asc(bottles.id))
    .for("update");
  const target = groups.find(({ id }) => id === groupId);
  const source = groups.find(({ id }) => id === sourceGroupId);
  const bottle = members.find(({ id }) => id === bottleId);
  if (!target) {
    throw new BottleGroupMoveError(
      "not_found",
      `BottleGroup ${groupId} not found.`,
    );
  }
  if (!source || !bottle || bottle.groupId !== sourceGroupId) {
    throw new BottleGroupMoveError(
      "conflict",
      `Bottle ${bottleId} changed groups during the move. Try again.`,
    );
  }
  const [tombstone] = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleId))
    .limit(1);
  if (tombstone) {
    throw new BottleGroupMoveError(
      "invalid",
      `Bottle ${bottleId} was merged or deleted.`,
    );
  }
  if (sourceGroupId === groupId) {
    return { bottle, changed: false };
  }

  const [sourceDistillerIds, targetDistillerIds] = await Promise.all([
    getGroupDistillerIds(tx, sourceGroupId),
    getGroupDistillerIds(tx, groupId),
  ]);
  const differences = getSharedFieldDifferences(
    bottle,
    target,
    sourceDistillerIds,
    targetDistillerIds,
  );
  if (differences.length) {
    throw new BottleGroupMoveError(
      "invalid",
      `Bottle ${bottleId} has a different ${differences.join(", ")} from BottleGroup ${groupId}. Edit the Bottle to match first.`,
    );
  }
  // A Bottle without an age would silently take the group's shared age.
  if (
    bottle.statedAge === null &&
    bottle.noAgeStatement !== true &&
    target.statedAge !== null
  ) {
    throw new BottleGroupMoveError(
      "invalid",
      `Bottle ${bottleId} has no age, but BottleGroup ${groupId} shares the age ${target.statedAge}. Clear the group age or set the Bottle's age first.`,
    );
  }

  const materialized = materializeBottleForGroup({
    group: target,
    exact: bottle,
  });
  const sameTitleProblem = await getSameTitleProblem(
    tx,
    {
      brandId: target.brandId,
      seriesId: target.seriesId,
      titleFullName: target.fullName,
      edition: bottle.edition,
      vintageYear: bottle.vintageYear,
      statedAge: materialized.statedAge,
    },
    groupId,
  );
  if (sameTitleProblem) {
    throw new BottleGroupMoveError("invalid", sameTitleProblem);
  }

  const [brand, bottler] = await Promise.all([
    loadEntity(tx, target.brandId),
    target.bottlerId === null ? null : loadEntity(tx, target.bottlerId),
  ]);
  try {
    await reserveBottleIdentitiesInTransaction(tx, {
      candidates: [
        {
          bottleId,
          current: { ...bottle, brand, bottler },
          desired: { ...bottle, ...materialized, brand, bottler },
        },
      ],
      assignedByActorId: actorId,
    });
  } catch (error) {
    if (error instanceof BottleIdentityConflictError) {
      throw new BottleGroupMoveError(
        "conflict",
        `Bottle ${error.conflictingBottleId} already has this identity. Merge the two Bottles instead.`,
        { cause: error },
      );
    }
    throw error;
  }

  const remaining = members.filter(
    ({ id, groupId: memberGroupId }) =>
      memberGroupId === sourceGroupId && id !== bottleId,
  );
  // The old group must stop naming this Bottle as its representative before
  // the Bottle leaves; the representative must be a member of its group.
  if (source.representativeBottleId === bottleId) {
    await tx
      .update(bottleGroups)
      .set({ representativeBottleId: remaining[0]?.id ?? null })
      .where(eq(bottleGroups.id, sourceGroupId));
  }

  const [moved] = await tx
    .update(bottles)
    .set({ ...materialized, groupId, updatedAt: new Date() })
    .where(eq(bottles.id, bottleId))
    .returning();
  if (!moved) {
    throw new BottleGroupMoveError(
      "conflict",
      `Bottle ${bottleId} could not be moved.`,
    );
  }

  if (remaining.length === 0) {
    await tx
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, sourceGroupId));
    await tx.delete(bottleGroups).where(eq(bottleGroups.id, sourceGroupId));
  } else {
    await recomputeBottleGroupStatsInTransaction(tx, sourceGroupId);
  }
  await recomputeBottleGroupStatsInTransaction(tx, groupId);

  await tx.insert(changes).values([
    {
      objectType: "bottle",
      objectId: bottleId,
      actorId,
      displayName: moved.fullName,
      type: "update",
      data: {
        updateScope: "group_move",
        fromGroupId: sourceGroupId,
        toGroupId: groupId,
        before: { name: bottle.name, fullName: bottle.fullName },
        after: { name: moved.name, fullName: moved.fullName },
      },
    },
    {
      objectType: "bottle_group",
      objectId: sourceGroupId,
      actorId,
      displayName: source.fullName,
      type: remaining.length === 0 ? "delete" : "update",
      data: {
        updateScope: "group_move",
        bottleId,
        toGroupId: groupId,
        before: source,
      },
    },
  ]);

  return { bottle: moved, changed: true };
}

/** Authorizes, commits, and reindexes one move between BottleGroups. */
export async function moveBottleToGroup({
  bottleId,
  groupId,
  context,
}: {
  bottleId: number;
  groupId: number;
  context: Context;
}): Promise<BottleGroupMoveResult> {
  if (!context.user || !canModerate(context.user)) {
    throw new BottleGroupMoveError(
      "forbidden",
      "Moderator authorization is required to move Bottles between groups.",
    );
  }
  const actor = await getUserActor(context.user);
  const result = await db.transaction((tx) =>
    moveBottleToGroupInTransaction(tx, {
      bottleId,
      groupId,
      actorId: actor.id,
    }),
  );
  if (result.changed) {
    try {
      await pushJob("OnBottleChange", { bottleId });
    } catch (error) {
      logError(error, { extra: { bottleId } });
    }
  }
  return result;
}
