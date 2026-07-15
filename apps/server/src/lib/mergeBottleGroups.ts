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
  collectionBottles,
  collections,
  entities,
  flightBottles,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  tastings,
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
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import type { Context } from "@peated/server/orpc/context";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

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

/** Owns destructive collection-target consolidation and its reversal preimages. */
async function consolidateCollectionRows(
  tx: AnyTransaction,
  sourceTargetId: number,
  destinationTargetId: number,
) {
  const rows = await tx
    .select()
    .from(collectionBottles)
    .where(
      or(
        eq(collectionBottles.targetId, sourceTargetId),
        eq(collectionBottles.targetId, destinationTargetId),
      ),
    )
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id))
    .for("update");
  const destinationByCollection = new Map(
    rows
      .filter(({ targetId }) => targetId === destinationTargetId)
      .map((row) => [row.collectionId, row]),
  );
  const sourceRows = rows.filter(({ targetId }) => targetId === sourceTargetId);
  const sourceCollectionIds = new Set(
    sourceRows.map(({ collectionId }) => collectionId),
  );
  const destinationRowsBefore = rows.filter(
    ({ collectionId, targetId }) =>
      targetId === destinationTargetId && sourceCollectionIds.has(collectionId),
  );
  const duplicateCollectionIds = new Set<number>();

  for (const source of sourceRows) {
    const destination = destinationByCollection.get(source.collectionId);
    if (!destination) {
      await tx
        .update(collectionBottles)
        .set({ targetId: destinationTargetId })
        .where(eq(collectionBottles.id, source.id));
      continue;
    }
    if (
      (!destination.imageUrl || destination.imageUrl.trim() === "") &&
      source.imageUrl &&
      source.imageUrl.trim() !== ""
    ) {
      await tx
        .update(collectionBottles)
        .set({ imageUrl: source.imageUrl })
        .where(eq(collectionBottles.id, destination.id));
    }
    await tx
      .delete(collectionBottles)
      .where(eq(collectionBottles.id, source.id));
    duplicateCollectionIds.add(source.collectionId);
  }

  for (const collectionId of Array.from(duplicateCollectionIds).sort(
    (left, right) => left - right,
  )) {
    await tx
      .update(collections)
      .set({
        totalBottles: sql`(SELECT COUNT(*) FROM ${collectionBottles} WHERE ${collectionBottles.collectionId} = ${collectionId})`,
      })
      .where(eq(collections.id, collectionId));
  }

  return { sourceRows, destinationRowsBefore };
}

/** Owns destructive flight-target consolidation and its reversal preimages. */
async function consolidateFlightRows(
  tx: AnyTransaction,
  sourceTargetId: number,
  destinationTargetId: number,
) {
  const rows = await tx
    .select()
    .from(flightBottles)
    .where(
      or(
        eq(flightBottles.targetId, sourceTargetId),
        eq(flightBottles.targetId, destinationTargetId),
      ),
    )
    .orderBy(
      asc(flightBottles.flightId),
      asc(flightBottles.bottleId),
      asc(flightBottles.releaseId),
    )
    .for("update");
  const sourceRows = rows.filter(({ targetId }) => targetId === sourceTargetId);
  const destinationFlightIds = new Set(
    rows
      .filter(({ targetId }) => targetId === destinationTargetId)
      .map(({ flightId }) => flightId),
  );

  for (const source of sourceRows) {
    if (destinationFlightIds.has(source.flightId)) {
      await tx
        .delete(flightBottles)
        .where(
          and(
            eq(flightBottles.flightId, source.flightId),
            eq(flightBottles.bottleId, source.bottleId),
            source.releaseId === null
              ? sql`${flightBottles.releaseId} IS NULL`
              : eq(flightBottles.releaseId, source.releaseId),
          ),
        );
      continue;
    }
    await tx
      .update(flightBottles)
      .set({ targetId: destinationTargetId })
      .where(
        and(
          eq(flightBottles.flightId, source.flightId),
          eq(flightBottles.bottleId, source.bottleId),
          source.releaseId === null
            ? sql`${flightBottles.releaseId} IS NULL`
            : eq(flightBottles.releaseId, source.releaseId),
        ),
      );
  }

  return sourceRows;
}

/** Repoints generic-target consumers and captures their reversal preimages. */
async function repointGenericTargetReferences(
  tx: AnyTransaction,
  sourceTargetId: number,
  destinationTargetId: number,
) {
  const collectionRows = await consolidateCollectionRows(
    tx,
    sourceTargetId,
    destinationTargetId,
  );
  const flightRows = await consolidateFlightRows(
    tx,
    sourceTargetId,
    destinationTargetId,
  );

  const tastingRows = await tx
    .select({
      id: tastings.id,
      targetId: tastings.targetId,
      createdById: tastings.createdById,
      createdAt: tastings.createdAt,
    })
    .from(tastings)
    .where(
      or(
        eq(tastings.targetId, sourceTargetId),
        eq(tastings.targetId, destinationTargetId),
      ),
    )
    .orderBy(
      asc(tastings.createdById),
      asc(tastings.createdAt),
      asc(tastings.id),
    )
    .for("update");
  const destinationTastingKeys = new Set(
    tastingRows
      .filter(({ targetId }) => targetId === destinationTargetId)
      .map(
        ({ createdById, createdAt }) => `${createdById}:${createdAt.getTime()}`,
      ),
  );
  if (
    tastingRows.some(
      ({ targetId, createdById, createdAt }) =>
        targetId === sourceTargetId &&
        destinationTastingKeys.has(`${createdById}:${createdAt.getTime()}`),
    )
  ) {
    throw new BottleGroupMergeConflictError("consumer_conflict");
  }

  const sourceTastings = tastingRows
    .filter(({ targetId }) => targetId === sourceTargetId)
    .map(({ id, targetId }) => ({ id, targetId }));
  const sourceReviews = await tx
    .select({ id: reviews.id, targetId: reviews.targetId })
    .from(reviews)
    .where(eq(reviews.targetId, sourceTargetId))
    .orderBy(asc(reviews.id))
    .for("update");
  const sourceStorePrices = await tx
    .select({ id: storePrices.id, targetId: storePrices.targetId })
    .from(storePrices)
    .where(eq(storePrices.targetId, sourceTargetId))
    .orderBy(asc(storePrices.id))
    .for("update");
  const sourceObservations = await tx
    .select({
      id: bottleObservations.id,
      targetId: bottleObservations.targetId,
    })
    .from(bottleObservations)
    .where(eq(bottleObservations.targetId, sourceTargetId))
    .orderBy(asc(bottleObservations.id))
    .for("update");
  const sourceDecisionLogs = await tx
    .select({
      id: incomingBottleDecisionLogs.id,
      targetId: incomingBottleDecisionLogs.targetId,
    })
    .from(incomingBottleDecisionLogs)
    .where(eq(incomingBottleDecisionLogs.targetId, sourceTargetId))
    .orderBy(asc(incomingBottleDecisionLogs.id))
    .for("update");
  const sourceProposals = await tx
    .select({
      id: storePriceMatchProposals.id,
      currentTargetId: storePriceMatchProposals.currentTargetId,
      suggestedTargetId: storePriceMatchProposals.suggestedTargetId,
      updatedAt: storePriceMatchProposals.updatedAt,
    })
    .from(storePriceMatchProposals)
    .where(
      or(
        eq(storePriceMatchProposals.currentTargetId, sourceTargetId),
        eq(storePriceMatchProposals.suggestedTargetId, sourceTargetId),
      ),
    )
    .orderBy(asc(storePriceMatchProposals.id))
    .for("update");
  const sourceAttempts = await tx
    .select({
      id: storePriceMatchAttempts.id,
      currentTargetId: storePriceMatchAttempts.currentTargetId,
      suggestedTargetId: storePriceMatchAttempts.suggestedTargetId,
      updatedAt: storePriceMatchAttempts.updatedAt,
    })
    .from(storePriceMatchAttempts)
    .where(
      or(
        eq(storePriceMatchAttempts.currentTargetId, sourceTargetId),
        eq(storePriceMatchAttempts.suggestedTargetId, sourceTargetId),
      ),
    )
    .orderBy(asc(storePriceMatchAttempts.id))
    .for("update");

  for (const [table, column] of [
    [tastings, tastings.targetId],
    [reviews, reviews.targetId],
    [storePrices, storePrices.targetId],
    [bottleObservations, bottleObservations.targetId],
    [incomingBottleDecisionLogs, incomingBottleDecisionLogs.targetId],
  ] as const) {
    await tx
      .update(table)
      .set({ targetId: destinationTargetId })
      .where(eq(column, sourceTargetId));
  }

  await tx
    .update(storePriceMatchProposals)
    .set({
      currentTargetId: sql`CASE WHEN ${storePriceMatchProposals.currentTargetId} = ${sourceTargetId} THEN ${destinationTargetId} ELSE ${storePriceMatchProposals.currentTargetId} END`,
      suggestedTargetId: sql`CASE WHEN ${storePriceMatchProposals.suggestedTargetId} = ${sourceTargetId} THEN ${destinationTargetId} ELSE ${storePriceMatchProposals.suggestedTargetId} END`,
      updatedAt: new Date(),
    })
    .where(
      or(
        eq(storePriceMatchProposals.currentTargetId, sourceTargetId),
        eq(storePriceMatchProposals.suggestedTargetId, sourceTargetId),
      ),
    );
  await tx
    .update(storePriceMatchAttempts)
    .set({
      currentTargetId: sql`CASE WHEN ${storePriceMatchAttempts.currentTargetId} = ${sourceTargetId} THEN ${destinationTargetId} ELSE ${storePriceMatchAttempts.currentTargetId} END`,
      suggestedTargetId: sql`CASE WHEN ${storePriceMatchAttempts.suggestedTargetId} = ${sourceTargetId} THEN ${destinationTargetId} ELSE ${storePriceMatchAttempts.suggestedTargetId} END`,
      updatedAt: new Date(),
    })
    .where(
      or(
        eq(storePriceMatchAttempts.currentTargetId, sourceTargetId),
        eq(storePriceMatchAttempts.suggestedTargetId, sourceTargetId),
      ),
    );

  return {
    collections: collectionRows,
    flights: flightRows,
    directTargets: {
      tastings: sourceTastings,
      reviews: sourceReviews,
      storePrices: sourceStorePrices,
      bottleObservations: sourceObservations,
      incomingBottleDecisionLogs: sourceDecisionLogs,
    },
    targetPairs: {
      storePriceMatchProposals: sourceProposals,
      storePriceMatchAttempts: sourceAttempts,
    },
  };
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

  const genericConsumerPreimages = await repointGenericTargetReferences(
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

function postgresConstraint(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const candidate = current as Error & {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (candidate.code === "23505") return candidate.constraint ?? null;
    current = candidate.cause;
  }
  return null;
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
  let result: BottleGroupMergeTransactionResult;
  try {
    result = await db.transaction((tx) =>
      mergeBottleGroupsInTransaction(tx, {
        sourceGroupId,
        destinationGroupId,
        actorId: actor.id,
      }),
    );
  } catch (error) {
    if (postgresConstraint(error) === "tasting_target_unq") {
      throw new BottleGroupMergeConflictError("consumer_conflict", null, {
        cause: error,
      });
    }
    throw error;
  }
  await finalizeBottleGroupMerge(result);
  return {
    sourceGroupId: result.sourceGroupId,
    destinationGroupId: result.destinationGroupId,
    changed: result.changed,
    movedBottleIds: result.movedBottleIds,
  };
}
