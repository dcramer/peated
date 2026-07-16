/**
 * Owns moderator-directed BottleGroup merges. Destination shared identity
 * rematerializes moved Bottles while Bottle and exact-target IDs stay stable;
 * source retirement and tombstoning commit atomically, and derived work starts
 * only after that transaction commits.
 */
import { db, type AnyTransaction } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  Entity,
  User,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottleObservations,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  catalogTargets,
  changes,
  entities,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  ConcreteBottleIdentityConflictError,
  reserveConcreteBottleIdentitiesInTransaction,
} from "@peated/server/lib/concreteBottleConflicts";
import {
  getConcreteBottleExactIdentity,
  materializeConcreteBottleForGroup,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  CatalogTargetConsumerConflictError,
  consolidateCatalogTargetConsumersInTransaction,
} from "@peated/server/lib/consolidateCatalogTargetConsumers";
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import type { Context } from "@peated/server/orpc/context";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

export class BottleGroupMergeAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to merge BottleGroups.");
    this.name = "BottleGroupMergeAuthorizationError";
  }
}

export class BottleGroupMergeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleGroupMergeInputError";
  }
}

export type BottleGroupMergeGraphErrorCode =
  | "not_found"
  | "retired"
  | "invalid_catalog_graph";

export class BottleGroupMergeGraphError extends Error {
  constructor(
    readonly code: BottleGroupMergeGraphErrorCode,
    readonly groupId: number,
  ) {
    super(`Cannot merge BottleGroup ${groupId}: ${code}.`);
    this.name = "BottleGroupMergeGraphError";
  }
}

export type BottleGroupMergeConflictCode =
  | "same_group"
  | "retired_to_other_destination"
  | "identity_conflict"
  | "consumer_conflict";

export class BottleGroupMergeConflictError extends Error {
  constructor(
    readonly code: BottleGroupMergeConflictCode,
    readonly conflictingBottleId: number | null = null,
    options?: ErrorOptions,
  ) {
    super(`BottleGroup merge failed: ${code}.`, options);
    this.name = "BottleGroupMergeConflictError";
  }
}

export type BottleGroupMergeResult = {
  sourceGroupId: number;
  destinationGroupId: number;
  changed: boolean;
  movedBottleIds: number[];
};

type BottleGroupMergeTransactionResult = BottleGroupMergeResult & {
  changedAliasNames: string[];
  affectedEntityIds: number[];
  affectedSeriesIds: number[];
};

type MaterializedBottle = ReturnType<typeof materializeConcreteBottleForGroup>;

function inertResult(
  sourceGroupId: number,
  destinationGroupId: number,
): BottleGroupMergeTransactionResult {
  return {
    sourceGroupId,
    destinationGroupId,
    changed: false,
    movedBottleIds: [],
    changedAliasNames: [],
    affectedEntityIds: [],
    affectedSeriesIds: [],
  };
}

function bottleSnapshot(
  bottle: Bottle,
  distillerIds: number[],
  targetId: number,
) {
  return {
    ...bottle,
    distillerIds,
    targetId,
  };
}

function uniqueSorted(values: Array<number | null>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => value !== null)),
  ).sort((left, right) => left - right);
}

function entityState(
  entityById: Map<number, Entity>,
  id: number | null,
  groupId: number,
) {
  if (id === null) return null;
  const entity = entityById.get(id);
  if (!entity) {
    throw new BottleGroupMergeGraphError("invalid_catalog_graph", groupId);
  }
  return entity;
}

/** Translates target-consumer conflicts into the BottleGroup merge contract. */
async function consolidateGenericTargetConsumers(
  tx: AnyTransaction,
  sourceTargetId: number,
  destinationTargetId: number,
) {
  try {
    return await consolidateCatalogTargetConsumersInTransaction(tx, {
      sourceTargetId,
      destinationTargetId,
    });
  } catch (error) {
    if (error instanceof CatalogTargetConsumerConflictError) {
      throw new BottleGroupMergeConflictError("consumer_conflict", null, {
        cause: error,
      });
    }
    throw error;
  }
}

/** Applies identity, consumer, retirement, and audit writes in the caller-owned transaction. */
async function mergeBottleGroupsInTransaction(
  tx: AnyTransaction,
  {
    sourceGroupId,
    destinationGroupId,
    actorId,
  }: {
    sourceGroupId: number;
    destinationGroupId: number;
    actorId: number;
  },
): Promise<BottleGroupMergeTransactionResult> {
  const requestedIds = [sourceGroupId, destinationGroupId].sort(
    (left, right) => left - right,
  );
  const lockedGroups = await tx
    .select()
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, requestedIds))
    .orderBy(asc(bottleGroups.id))
    .for("update");
  const groupById = new Map(lockedGroups.map((group) => [group.id, group]));
  const sourceGroup = groupById.get(sourceGroupId);
  const destinationGroup = groupById.get(destinationGroupId);

  const groupTombstones = await tx
    .select()
    .from(bottleGroupTombstones)
    .where(inArray(bottleGroupTombstones.groupId, requestedIds))
    .orderBy(asc(bottleGroupTombstones.groupId))
    .for("update");
  const tombstoneById = new Map(
    groupTombstones.map((tombstone) => [tombstone.groupId, tombstone]),
  );
  const sourceTombstone = tombstoneById.get(sourceGroupId);
  if (!sourceGroup) {
    if (sourceTombstone?.newGroupId === destinationGroupId) {
      return inertResult(sourceGroupId, destinationGroupId);
    }
    if (sourceTombstone) {
      throw new BottleGroupMergeConflictError("retired_to_other_destination");
    }
    throw new BottleGroupMergeGraphError("not_found", sourceGroupId);
  }
  if (sourceTombstone) {
    throw new BottleGroupMergeGraphError("retired", sourceGroupId);
  }
  if (!destinationGroup) {
    throw new BottleGroupMergeGraphError(
      tombstoneById.has(destinationGroupId) ? "retired" : "not_found",
      destinationGroupId,
    );
  }
  if (tombstoneById.has(destinationGroupId)) {
    throw new BottleGroupMergeGraphError("retired", destinationGroupId);
  }

  const members = await tx
    .select()
    .from(bottles)
    .where(inArray(bottles.groupId, requestedIds))
    .orderBy(asc(bottles.id))
    .for("update");
  const sourceMembers = members.filter(
    ({ groupId }) => groupId === sourceGroupId,
  );
  const destinationMembers = members.filter(
    ({ groupId }) => groupId === destinationGroupId,
  );
  if (!sourceMembers.length || !destinationMembers.length) {
    throw new BottleGroupMergeGraphError(
      "invalid_catalog_graph",
      !sourceMembers.length ? sourceGroupId : destinationGroupId,
    );
  }
  const memberIds = members.map(({ id }) => id);
  const retiredMembers = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, memberIds));
  if (retiredMembers.length) {
    throw new BottleGroupMergeGraphError(
      "invalid_catalog_graph",
      members.find(({ id }) =>
        retiredMembers.some(({ bottleId }) => bottleId === id),
      )?.groupId ?? sourceGroupId,
    );
  }
  for (const group of [sourceGroup, destinationGroup]) {
    if (
      group.representativeBottleId === null ||
      !members.some(
        ({ id, groupId }) =>
          id === group.representativeBottleId && groupId === group.id,
      )
    ) {
      throw new BottleGroupMergeGraphError("invalid_catalog_graph", group.id);
    }
  }

  const targets = await tx
    .select()
    .from(catalogTargets)
    .where(inArray(catalogTargets.groupId, requestedIds))
    .orderBy(asc(catalogTargets.groupId), asc(catalogTargets.id))
    .for("update");
  const targetByBottleId = new Map(
    targets.flatMap((target) =>
      target.bottleId === null ? [] : [[target.bottleId, target] as const],
    ),
  );
  const genericTargets = targets.filter(({ bottleId }) => bottleId === null);
  const sourceGenericTarget = genericTargets.find(
    ({ groupId }) => groupId === sourceGroupId,
  );
  const destinationGenericTarget = genericTargets.find(
    ({ groupId }) => groupId === destinationGroupId,
  );
  if (
    genericTargets.length !== 2 ||
    !sourceGenericTarget ||
    !destinationGenericTarget ||
    targets.length !== members.length + 2 ||
    members.some(({ id, groupId }) => {
      const target = targetByBottleId.get(id);
      return !target || target.groupId !== groupId;
    })
  ) {
    throw new BottleGroupMergeGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const groupDistillers = await tx
    .select()
    .from(bottleGroupDistillers)
    .where(inArray(bottleGroupDistillers.groupId, requestedIds))
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    )
    .for("share");
  const sourceDistillerIds = groupDistillers
    .filter(({ groupId }) => groupId === sourceGroupId)
    .map(({ distillerId }) => distillerId);
  const destinationDistillerIds = groupDistillers
    .filter(({ groupId }) => groupId === destinationGroupId)
    .map(({ distillerId }) => distillerId);
  const currentBottleDistillers = await tx
    .select()
    .from(bottlesToDistillers)
    .where(inArray(bottlesToDistillers.bottleId, memberIds))
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    )
    .for("share");
  const distillersByBottleId = new Map<number, number[]>();
  for (const row of currentBottleDistillers) {
    const distillerIds = distillersByBottleId.get(row.bottleId) ?? [];
    distillerIds.push(row.distillerId);
    distillersByBottleId.set(row.bottleId, distillerIds);
  }
  if (
    members.some((member) => {
      const expected =
        member.groupId === sourceGroupId
          ? sourceDistillerIds
          : destinationDistillerIds;
      const actual = distillersByBottleId.get(member.id) ?? [];
      return (
        expected.length !== actual.length ||
        expected.some((id, index) => id !== actual[index])
      );
    })
  ) {
    throw new BottleGroupMergeGraphError(
      "invalid_catalog_graph",
      sourceGroupId,
    );
  }

  const entityIds = uniqueSorted([
    sourceGroup.brandId,
    sourceGroup.bottlerId,
    destinationGroup.brandId,
    destinationGroup.bottlerId,
    ...sourceDistillerIds,
    ...destinationDistillerIds,
  ]);
  const identityEntities = await tx
    .select()
    .from(entities)
    .where(inArray(entities.id, entityIds))
    .orderBy(asc(entities.id));
  if (identityEntities.length !== entityIds.length) {
    throw new BottleGroupMergeGraphError(
      "invalid_catalog_graph",
      destinationGroupId,
    );
  }
  const entityById = new Map(
    identityEntities.map((entity) => [entity.id, entity]),
  );
  const sourceBrand = entityState(
    entityById,
    sourceGroup.brandId,
    sourceGroupId,
  )!;
  const sourceBottler = entityState(
    entityById,
    sourceGroup.bottlerId,
    sourceGroupId,
  );
  const destinationBrand = entityState(
    entityById,
    destinationGroup.brandId,
    destinationGroupId,
  )!;
  const destinationBottler = entityState(
    entityById,
    destinationGroup.bottlerId,
    destinationGroupId,
  );

  const desiredByBottleId = new Map<number, MaterializedBottle>();
  for (const member of sourceMembers) {
    const exact = getConcreteBottleExactIdentity({
      bottle: member,
      sourceGroupStatedAge: sourceGroup.statedAge,
    });
    desiredByBottleId.set(
      member.id,
      materializeConcreteBottleForGroup({
        group: destinationGroup,
        exact,
      }),
    );
  }

  let identityReservation;
  try {
    identityReservation = await reserveConcreteBottleIdentitiesInTransaction(
      tx,
      {
        candidates: sourceMembers.map((member) => ({
          bottleId: member.id,
          targetId: targetByBottleId.get(member.id)!.id,
          current: {
            name: member.name,
            fullName: member.fullName,
            brand: sourceBrand,
            bottler: sourceBottler,
          },
          desired: {
            name: desiredByBottleId.get(member.id)!.name,
            fullName: desiredByBottleId.get(member.id)!.fullName,
            brand: destinationBrand,
            bottler: destinationBottler,
          },
        })),
        assignedByActorId: actorId,
      },
    );
  } catch (error) {
    if (error instanceof ConcreteBottleIdentityConflictError) {
      throw new BottleGroupMergeConflictError(
        "identity_conflict",
        error.conflictingBottleId,
        { cause: error },
      );
    }
    throw error;
  }

  const stableAliases = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
      assignedByActorId: bottleAliases.assignedByActorId,
      createdAt: bottleAliases.createdAt,
    })
    .from(bottleAliases)
    .where(eq(bottleAliases.targetId, sourceGenericTarget.id))
    .orderBy(asc(bottleAliases.name))
    .for("update");
  await tx
    .update(bottleAliases)
    .set({ targetId: destinationGenericTarget.id })
    .where(eq(bottleAliases.targetId, sourceGenericTarget.id));

  const genericConsumerPreimages = await consolidateGenericTargetConsumers(
    tx,
    sourceGenericTarget.id,
    destinationGenericTarget.id,
  );

  // The representative FK must clear before members move; exact-target group
  // membership follows each Bottle groupId through its ON UPDATE cascade.
  await tx
    .update(bottleGroups)
    .set({ representativeBottleId: null })
    .where(eq(bottleGroups.id, sourceGroupId));
  await tx.delete(bottlesToDistillers).where(
    inArray(
      bottlesToDistillers.bottleId,
      sourceMembers.map(({ id }) => id),
    ),
  );

  for (const member of sourceMembers) {
    const desired = desiredByBottleId.get(member.id)!;
    const targetId = targetByBottleId.get(member.id)!.id;
    const [updated] = await tx
      .update(bottles)
      .set({
        groupId: destinationGroupId,
        ...desired,
        updatedAt: new Date(),
      })
      .where(and(eq(bottles.id, member.id), eq(bottles.groupId, sourceGroupId)))
      .returning();
    if (!updated) {
      throw new BottleGroupMergeGraphError(
        "invalid_catalog_graph",
        sourceGroupId,
      );
    }
    if (destinationDistillerIds.length) {
      await tx.insert(bottlesToDistillers).values(
        destinationDistillerIds.map((distillerId) => ({
          bottleId: member.id,
          distillerId,
        })),
      );
    }
    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: member.id,
      actorId,
      displayName: updated.fullName,
      type: "update",
      data: {
        updateScope: "group_merge",
        sourceGroupId,
        destinationGroupId,
        before: bottleSnapshot(
          member,
          distillersByBottleId.get(member.id) ?? [],
          targetId,
        ),
        after: bottleSnapshot(updated, destinationDistillerIds, targetId),
        retainedAliasNames: Array.from(
          new Set([member.fullName, desired.fullName]),
        ).sort(),
        aliasMutations: identityReservation.aliasMutations.filter(
          ({ bottleId }) => bottleId === member.id,
        ),
      },
    });
  }

  const affectedSeriesIds = uniqueSorted(
    sourceMembers
      .filter(
        (member) =>
          member.seriesId !== desiredByBottleId.get(member.id)!.seriesId,
      )
      .flatMap((member) => [
        member.seriesId,
        desiredByBottleId.get(member.id)!.seriesId,
      ]),
  );
  for (const seriesId of affectedSeriesIds) {
    await tx
      .update(bottleSeries)
      .set({
        numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId})`,
      })
      .where(eq(bottleSeries.id, seriesId));
  }

  const predecessorTombstonesBefore = await tx
    .select({
      groupId: bottleGroupTombstones.groupId,
      newGroupId: bottleGroupTombstones.newGroupId,
      createdByActorId: bottleGroupTombstones.createdByActorId,
      createdAt: bottleGroupTombstones.createdAt,
    })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.newGroupId, sourceGroupId))
    .orderBy(asc(bottleGroupTombstones.groupId))
    .for("update");

  await tx.insert(changes).values({
    objectType: "bottle_group",
    objectId: sourceGroupId,
    actorId,
    displayName: sourceGroup.fullName,
    type: "delete",
    data: {
      before: {
        ...sourceGroup,
        distillerIds: sourceDistillerIds,
        genericTarget: sourceGenericTarget,
      },
      destinationGroupId,
      sourceGenericTargetId: sourceGenericTarget.id,
      destinationGenericTargetId: destinationGenericTarget.id,
      movedBottleIds: sourceMembers.map(({ id }) => id),
      stableAliasesBefore: stableAliases,
      genericConsumerPreimages,
      predecessorTombstonesBefore,
    },
  });

  await tx
    .update(bottleGroupTombstones)
    .set({ newGroupId: destinationGroupId })
    .where(eq(bottleGroupTombstones.newGroupId, sourceGroupId));
  await tx.insert(bottleGroupTombstones).values({
    groupId: sourceGroupId,
    newGroupId: destinationGroupId,
    createdByActorId: actorId,
  });
  await tx
    .delete(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, sourceGroupId));
  await tx
    .delete(catalogTargets)
    .where(eq(catalogTargets.id, sourceGenericTarget.id));
  await tx.delete(bottleGroups).where(eq(bottleGroups.id, sourceGroupId));

  const destinationStats = await recomputeBottleGroupStatsInTransaction(
    tx,
    destinationGroupId,
  );
  await tx.insert(changes).values({
    objectType: "bottle_group",
    objectId: destinationGroupId,
    actorId,
    displayName: destinationGroup.fullName,
    type: "update",
    data: {
      updateScope: "group_merge",
      sourceGroupId,
      before: {
        ...destinationGroup,
        distillerIds: destinationDistillerIds,
        genericTarget: destinationGenericTarget,
      },
      after: {
        ...destinationGroup,
        totalBottles: destinationStats.totalBottles,
        totalTastings: destinationStats.totalTastings,
        avgRating: destinationStats.avgRating,
        ratingStats: destinationStats.ratingStats,
        updatedAt: destinationStats.updatedAt,
        distillerIds: destinationDistillerIds,
        genericTarget: destinationGenericTarget,
      },
    },
  });

  return {
    sourceGroupId,
    destinationGroupId,
    changed: true,
    movedBottleIds: sourceMembers.map(({ id }) => id),
    changedAliasNames: Array.from(
      new Set([
        ...stableAliases.map(({ name }) => name),
        ...identityReservation.changedAliasNames,
      ]),
    ).sort(),
    affectedEntityIds: entityIds,
    affectedSeriesIds,
  };
}

/** Dispatches idempotent derived work after the authoritative merge commits. */
async function finalizeBottleGroupMerge(
  result: BottleGroupMergeTransactionResult,
) {
  for (const bottleId of result.movedBottleIds) {
    try {
      await pushUniqueJob("OnBottleChange", { bottleId });
    } catch (error) {
      logError(error, { bottle: { id: bottleId } });
    }
  }
  for (const name of result.changedAliasNames) {
    try {
      await pushUniqueJob("OnBottleAliasChange", { name });
    } catch (error) {
      logError(error, { bottleAlias: { name } });
    }
  }
  for (const entityId of result.affectedEntityIds) {
    try {
      await pushUniqueJob("OnEntityChange", { entityId });
    } catch (error) {
      logError(error, { entity: { id: entityId } });
    }
  }
  for (const seriesId of result.affectedSeriesIds) {
    try {
      await pushUniqueJob("IndexBottleSeriesSearchVectors", { seriesId });
    } catch (error) {
      logError(error, { series: { id: seriesId } });
    }
  }
}

/** Authorizes and executes a one-source-to-destination BottleGroup merge. */
export async function mergeBottleGroups({
  sourceGroupId,
  destinationGroupId,
  context,
}: {
  sourceGroupId: number;
  destinationGroupId: number;
  context: Context;
}): Promise<BottleGroupMergeResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new BottleGroupMergeAuthorizationError();
  }
  if (!Number.isInteger(sourceGroupId) || sourceGroupId <= 0) {
    throw new BottleGroupMergeInputError(
      "Source BottleGroup ID must be a positive integer.",
    );
  }
  if (!Number.isInteger(destinationGroupId) || destinationGroupId <= 0) {
    throw new BottleGroupMergeInputError(
      "Destination BottleGroup ID must be a positive integer.",
    );
  }
  if (sourceGroupId === destinationGroupId) {
    throw new BottleGroupMergeConflictError("same_group");
  }

  const [existingTombstone] = await db
    .select({ newGroupId: bottleGroupTombstones.newGroupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, sourceGroupId))
    .limit(1);
  if (existingTombstone?.newGroupId === destinationGroupId) {
    return {
      sourceGroupId,
      destinationGroupId,
      changed: false,
      movedBottleIds: [],
    };
  }

  const user: User = context.user;
  const actor = await getUserActor(user);
  const result = await db.transaction((tx) =>
    mergeBottleGroupsInTransaction(tx, {
      sourceGroupId,
      destinationGroupId,
      actorId: actor.id,
    }),
  );
  await finalizeBottleGroupMerge(result);
  return {
    sourceGroupId: result.sourceGroupId,
    destinationGroupId: result.destinationGroupId,
    changed: result.changed,
    movedBottleIds: result.movedBottleIds,
  };
}
