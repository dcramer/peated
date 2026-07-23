/**
 * Owns exact-Bottle duplicate merges. The selected destination remains the
 * complete authoritative Bottle; only references, derived counts, and catalog
 * lifecycle records move from the source.
 */
import { db, type AnyTransaction } from "@peated/server/db";
import type {
  Bottle,
  BottleGroup,
  BottleTombstone,
  User,
} from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleGroupTombstones,
  bottleObservations,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  catalogTargets,
  changes,
  collectionBottles,
  collections,
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
  CatalogTargetConsumerConflictError,
  consolidateCatalogTargetConsumersInTransaction,
} from "@peated/server/lib/consolidateCatalogTargetConsumers";
import { appendExactBottleMergePromotionEvent } from "@peated/server/lib/exactBottleMergePromotionMetadata";
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import type { Context } from "@peated/server/orpc/context";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

export class ConcreteBottleMergeAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to merge Bottles.");
    this.name = "ConcreteBottleMergeAuthorizationError";
  }
}

export class ConcreteBottleMergeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcreteBottleMergeInputError";
  }
}

export type ConcreteBottleMergeGraphErrorCode =
  | "not_found"
  | "retired"
  | "unmigrated"
  | "invalid_catalog_graph";

export class ConcreteBottleMergeGraphError extends Error {
  constructor(
    readonly code: ConcreteBottleMergeGraphErrorCode,
    readonly bottleId: number,
    options?: ErrorOptions,
  ) {
    super(`Cannot merge Bottle ${bottleId}: ${code}.`, options);
    this.name = "ConcreteBottleMergeGraphError";
  }
}

export type ConcreteBottleMergeConflictCode =
  | "same_bottle"
  | "retired_to_other_destination"
  | "source_representative_has_survivors"
  | "identity_conflict"
  | "consumer_conflict";

export class ConcreteBottleMergeConflictError extends Error {
  constructor(
    readonly code: ConcreteBottleMergeConflictCode,
    options?: ErrorOptions,
  ) {
    super(`Concrete Bottle merge failed: ${code}.`, options);
    this.name = "ConcreteBottleMergeConflictError";
  }
}

export type ConcreteBottleMergeResult = {
  sourceBottleId: number;
  destinationBottleId: number;
  destinationBottle: Bottle;
  changed: boolean;
};

export type ConcreteBottleMergeFinalizationManifest =
  ConcreteBottleMergeResult & {
    destinationTargetId: number;
    aliasNames: string[];
    entityIds: number[];
    seriesIds: number[];
  };

function inertManifest(
  sourceBottleId: number,
  destinationBottleId: number,
  destinationBottle: Bottle,
  destinationTargetId: number,
): ConcreteBottleMergeFinalizationManifest {
  return {
    sourceBottleId,
    destinationBottleId,
    destinationBottle,
    destinationTargetId,
    changed: false,
    aliasNames: [],
    entityIds: [],
    seriesIds: [],
  };
}

function uniqueSorted(values: Array<number | null>): number[] {
  return Array.from(
    new Set(values.filter((value): value is number => value !== null)),
  ).sort((left, right) => left - right);
}

function validateMergeInput(
  sourceBottleId: number,
  destinationBottleId: number,
) {
  if (!Number.isInteger(sourceBottleId) || sourceBottleId <= 0) {
    throw new ConcreteBottleMergeInputError(
      "Source Bottle ID must be a positive integer.",
    );
  }
  if (!Number.isInteger(destinationBottleId) || destinationBottleId <= 0) {
    throw new ConcreteBottleMergeInputError(
      "Destination Bottle ID must be a positive integer.",
    );
  }
  if (sourceBottleId === destinationBottleId) {
    throw new ConcreteBottleMergeConflictError("same_bottle");
  }
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

/** Reconciles legacy collection keys after exact-target consolidation. */
async function consolidateLegacyCollectionRows(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
  destinationTargetId: number,
) {
  const rows = await tx
    .select()
    .from(collectionBottles)
    .where(
      inArray(collectionBottles.bottleId, [
        sourceBottleId,
        destinationBottleId,
      ]),
    )
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id))
    .for("update");
  const destinationByKey = new Map(
    rows
      .filter(({ bottleId }) => bottleId === destinationBottleId)
      .map((row) => [`${row.collectionId}:${row.releaseId ?? "null"}`, row]),
  );
  const allSourceRows = rows.filter(
    ({ bottleId }) => bottleId === sourceBottleId,
  );
  const sourceRows = allSourceRows.filter(
    ({ bottleId, targetId }) =>
      bottleId === sourceBottleId &&
      (targetId === null || targetId === destinationTargetId),
  );
  const destinationRowsBefore = [] as typeof rows;
  const changedCollectionIds = new Set<number>();

  // Distinct non-null target intent cannot be collapsed through the legacy key.
  for (const source of allSourceRows) {
    const destination = destinationByKey.get(
      `${source.collectionId}:${source.releaseId ?? "null"}`,
    );
    if (
      destination &&
      ((source.targetId !== null && source.targetId !== destinationTargetId) ||
        (destination.targetId !== null &&
          destination.targetId !== destinationTargetId))
    ) {
      throw new ConcreteBottleMergeConflictError("consumer_conflict");
    }
  }

  for (const source of sourceRows) {
    const destination = destinationByKey.get(
      `${source.collectionId}:${source.releaseId ?? "null"}`,
    );
    if (!destination) {
      await tx
        .update(collectionBottles)
        .set({ bottleId: destinationBottleId })
        .where(eq(collectionBottles.id, source.id));
      continue;
    }
    destinationRowsBefore.push(destination);
    const imageUrl =
      (!destination.imageUrl || destination.imageUrl.trim() === "") &&
      source.imageUrl &&
      source.imageUrl.trim() !== ""
        ? source.imageUrl
        : destination.imageUrl;
    const targetId =
      source.targetId === destinationTargetId
        ? destinationTargetId
        : destination.targetId;
    await tx
      .delete(collectionBottles)
      .where(eq(collectionBottles.id, source.id));
    await tx
      .update(collectionBottles)
      .set({ imageUrl, targetId })
      .where(eq(collectionBottles.id, destination.id));
    changedCollectionIds.add(source.collectionId);
  }

  for (const collectionId of changedCollectionIds) {
    await tx
      .update(collections)
      .set({
        totalBottles: sql`(SELECT COUNT(*) FROM ${collectionBottles} WHERE ${collectionBottles.collectionId} = ${collectionId})`,
      })
      .where(eq(collections.id, collectionId));
  }
  return { sourceRows, destinationRowsBefore };
}

/** Reconciles legacy flight keys after exact-target consolidation. */
async function consolidateLegacyFlightRows(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
  destinationTargetId: number,
) {
  const rows = await tx
    .select()
    .from(flightBottles)
    .where(
      inArray(flightBottles.bottleId, [sourceBottleId, destinationBottleId]),
    )
    .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId))
    .for("update");
  const destinationByKey = new Map(
    rows
      .filter(({ bottleId }) => bottleId === destinationBottleId)
      .map((row) => [`${row.flightId}:${row.releaseId ?? "null"}`, row]),
  );
  const allSourceRows = rows.filter(
    ({ bottleId }) => bottleId === sourceBottleId,
  );
  const sourceRows = allSourceRows.filter(
    ({ bottleId, targetId }) =>
      bottleId === sourceBottleId &&
      (targetId === null || targetId === destinationTargetId),
  );
  const destinationRowsBefore = [] as typeof rows;
  // Preflight every collision before deleting or repointing any membership.
  for (const source of allSourceRows) {
    const destination = destinationByKey.get(
      `${source.flightId}:${source.releaseId ?? "null"}`,
    );
    if (
      destination &&
      ((source.targetId !== null && source.targetId !== destinationTargetId) ||
        (destination.targetId !== null &&
          destination.targetId !== destinationTargetId))
    ) {
      throw new ConcreteBottleMergeConflictError("consumer_conflict");
    }
  }
  for (const source of sourceRows) {
    const where = and(
      eq(flightBottles.flightId, source.flightId),
      eq(flightBottles.bottleId, sourceBottleId),
      source.releaseId === null
        ? isNull(flightBottles.releaseId)
        : eq(flightBottles.releaseId, source.releaseId),
    );
    const destination = destinationByKey.get(
      `${source.flightId}:${source.releaseId ?? "null"}`,
    );
    if (destination) {
      destinationRowsBefore.push(destination);
      await tx.delete(flightBottles).where(where);
      if (
        source.targetId === destinationTargetId &&
        destination.targetId === null
      ) {
        await tx
          .update(flightBottles)
          .set({ targetId: destinationTargetId })
          .where(
            and(
              eq(flightBottles.flightId, destination.flightId),
              eq(flightBottles.bottleId, destinationBottleId),
              destination.releaseId === null
                ? isNull(flightBottles.releaseId)
                : eq(flightBottles.releaseId, destination.releaseId),
            ),
          );
      }
    } else {
      await tx
        .update(flightBottles)
        .set({ bottleId: destinationBottleId })
        .where(where);
    }
  }
  return { sourceRows, destinationRowsBefore };
}

/** Captures legacy consumer state persisted in the reversible merge audit. */
async function loadLegacyConsumerPreimages(
  tx: AnyTransaction,
  sourceBottleId: number,
) {
  return {
    tastings: await tx
      .select()
      .from(tastings)
      .where(eq(tastings.bottleId, sourceBottleId))
      .for("update"),
    reviews: await tx
      .select()
      .from(reviews)
      .where(eq(reviews.bottleId, sourceBottleId))
      .for("update"),
    storePrices: await tx
      .select()
      .from(storePrices)
      .where(eq(storePrices.bottleId, sourceBottleId))
      .for("update"),
    bottleObservations: await tx
      .select()
      .from(bottleObservations)
      .where(eq(bottleObservations.bottleId, sourceBottleId))
      .for("update"),
    incomingBottleDecisionLogs: await tx
      .select()
      .from(incomingBottleDecisionLogs)
      .where(eq(incomingBottleDecisionLogs.bottleId, sourceBottleId))
      .for("update"),
    storePriceMatchProposals: await tx
      .select()
      .from(storePriceMatchProposals)
      .where(
        or(
          eq(storePriceMatchProposals.currentBottleId, sourceBottleId),
          eq(storePriceMatchProposals.suggestedBottleId, sourceBottleId),
          eq(storePriceMatchProposals.parentBottleId, sourceBottleId),
        ),
      )
      .for("update"),
    storePriceMatchAttempts: await tx
      .select()
      .from(storePriceMatchAttempts)
      .where(
        or(
          eq(storePriceMatchAttempts.currentBottleId, sourceBottleId),
          eq(storePriceMatchAttempts.suggestedBottleId, sourceBottleId),
          eq(storePriceMatchAttempts.parentBottleId, sourceBottleId),
        ),
      )
      .for("update"),
  };
}

async function repointLegacyBottleConsumers(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  for (const [table, column] of [
    [collectionBottles, collectionBottles.bottleId],
    [flightBottles, flightBottles.bottleId],
    [tastings, tastings.bottleId],
    [reviews, reviews.bottleId],
    [storePrices, storePrices.bottleId],
    [bottleObservations, bottleObservations.bottleId],
    [incomingBottleDecisionLogs, incomingBottleDecisionLogs.bottleId],
  ] as const) {
    await tx
      .update(table)
      .set({ bottleId: destinationBottleId })
      .where(eq(column, sourceBottleId));
  }
  for (const table of [
    storePriceMatchProposals,
    storePriceMatchAttempts,
  ] as const) {
    await tx
      .update(table)
      .set({
        currentBottleId: sql`CASE WHEN ${table.currentBottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${table.currentBottleId} END`,
        suggestedBottleId: sql`CASE WHEN ${table.suggestedBottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${table.suggestedBottleId} END`,
        parentBottleId: sql`CASE WHEN ${table.parentBottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${table.parentBottleId} END`,
        updatedAt: new Date(),
      })
      .where(
        or(
          eq(table.currentBottleId, sourceBottleId),
          eq(table.suggestedBottleId, sourceBottleId),
          eq(table.parentBottleId, sourceBottleId),
        ),
      );
  }
}

/** Builds the BottleGroup snapshot persisted in the reversible merge audit. */
function groupSnapshot(group: BottleGroup, genericTargetId: number) {
  return { ...group, genericTargetId };
}

/** Builds the exact Bottle snapshot persisted in the reversible merge audit. */
function bottleSnapshot(
  bottle: Bottle,
  exactTargetId: number,
  distillerIds: number[],
) {
  return { ...bottle, exactTargetId, distillerIds };
}

/** Loads the live destination graph required for an inert tombstone retry. */
async function loadRetryDestinationSnapshot(
  tx: AnyTransaction,
  destinationBottleId: number,
): Promise<{ bottle: Bottle; targetId: number }> {
  const [destination] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, destinationBottleId))
    .limit(1)
    .for("update");
  if (!destination) {
    throw new ConcreteBottleMergeGraphError("not_found", destinationBottleId);
  }
  if (destination.groupId === null) {
    throw new ConcreteBottleMergeGraphError("unmigrated", destinationBottleId);
  }

  const [group] = await tx
    .select()
    .from(bottleGroups)
    .where(eq(bottleGroups.id, destination.groupId))
    .limit(1)
    .for("update");
  if (!group?.representativeBottleId) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      destinationBottleId,
    );
  }
  const [representative] = await tx
    .select({ groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, group.representativeBottleId))
    .limit(1)
    .for("update");
  const targets = await tx
    .select({ id: catalogTargets.id, bottleId: catalogTargets.bottleId })
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, destination.groupId))
    .for("update");
  const [retiredGroup] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, destination.groupId))
    .limit(1);
  const exactTarget = targets.find(
    ({ bottleId }) => bottleId === destinationBottleId,
  );
  if (
    retiredGroup ||
    representative?.groupId !== destination.groupId ||
    !targets.some(({ bottleId }) => bottleId === null) ||
    !exactTarget
  ) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      destinationBottleId,
    );
  }
  return { bottle: destination, targetId: exactTarget.id };
}

/**
 * Commits one exact duplicate merge inside the caller-owned transaction. The
 * returned manifest must only be finalized after the outermost commit.
 */
export async function mergeConcreteBottlesInTransaction(
  tx: AnyTransaction,
  {
    sourceBottleId,
    destinationBottleId,
    actorId,
  }: {
    sourceBottleId: number;
    destinationBottleId: number;
    actorId: number;
  },
): Promise<ConcreteBottleMergeFinalizationManifest> {
  validateMergeInput(sourceBottleId, destinationBottleId);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new ConcreteBottleMergeInputError(
      "Actor ID must be a positive integer.",
    );
  }

  const requestedBottleIds = [sourceBottleId, destinationBottleId].sort(
    (left, right) => left - right,
  );
  const tombstones = await tx
    .select()
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, requestedBottleIds))
    .orderBy(asc(bottleTombstones.bottleId))
    .for("update");
  const tombstoneByBottleId = new Map(
    tombstones.map((tombstone) => [tombstone.bottleId, tombstone]),
  );
  const sourceTombstone = tombstoneByBottleId.get(sourceBottleId);
  if (tombstoneByBottleId.has(destinationBottleId)) {
    throw new ConcreteBottleMergeGraphError("retired", destinationBottleId);
  }
  if (sourceTombstone?.newBottleId === destinationBottleId) {
    const destination = await loadRetryDestinationSnapshot(
      tx,
      destinationBottleId,
    );
    return inertManifest(
      sourceBottleId,
      destinationBottleId,
      destination.bottle,
      destination.targetId,
    );
  }
  if (sourceTombstone) {
    throw new ConcreteBottleMergeConflictError("retired_to_other_destination");
  }

  const lockedBottles = await tx
    .select()
    .from(bottles)
    .where(inArray(bottles.id, requestedBottleIds))
    .orderBy(asc(bottles.id))
    .for("update");
  const bottleById = new Map(
    lockedBottles.map((bottle) => [bottle.id, bottle]),
  );
  const source = bottleById.get(sourceBottleId);
  const destination = bottleById.get(destinationBottleId);
  if (!source)
    throw new ConcreteBottleMergeGraphError("not_found", sourceBottleId);
  if (!destination) {
    throw new ConcreteBottleMergeGraphError("not_found", destinationBottleId);
  }
  if (source.groupId === null) {
    throw new ConcreteBottleMergeGraphError("unmigrated", sourceBottleId);
  }
  if (destination.groupId === null) {
    throw new ConcreteBottleMergeGraphError("unmigrated", destinationBottleId);
  }
  const sourceGroupId = source.groupId;
  const destinationGroupId = destination.groupId;
  const groupIds = uniqueSorted([sourceGroupId, destinationGroupId]);

  const groups = await tx
    .select()
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, groupIds))
    .orderBy(asc(bottleGroups.id))
    .for("update");
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const sourceGroup = groupById.get(sourceGroupId);
  const destinationGroup = groupById.get(destinationGroupId);
  if (!sourceGroup || !destinationGroup) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      !sourceGroup ? sourceBottleId : destinationBottleId,
    );
  }
  const retiredGroups = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(inArray(bottleGroupTombstones.groupId, groupIds));
  if (retiredGroups.length) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      retiredGroups[0]!.groupId === sourceGroupId
        ? sourceBottleId
        : destinationBottleId,
    );
  }

  const sourceMembers = await tx
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.groupId, sourceGroupId))
    .orderBy(asc(bottles.id))
    .for("update");
  const sourceMemberIds = sourceMembers.map(({ id }) => id);
  if (
    !sourceMemberIds.includes(sourceBottleId) ||
    sourceGroup.representativeBottleId === null ||
    !sourceMemberIds.includes(sourceGroup.representativeBottleId) ||
    destinationGroup.representativeBottleId === null
  ) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      sourceBottleId,
    );
  }
  const [destinationRepresentative] = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(eq(bottles.id, destinationGroup.representativeBottleId))
    .limit(1)
    .for("update");
  if (destinationRepresentative?.groupId !== destinationGroupId) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      destinationBottleId,
    );
  }
  const crossGroup = sourceGroupId !== destinationGroupId;
  const sourceSingleton = sourceMemberIds.length === 1;
  if (
    crossGroup &&
    !sourceSingleton &&
    sourceGroup.representativeBottleId === sourceBottleId
  ) {
    throw new ConcreteBottleMergeConflictError(
      "source_representative_has_survivors",
    );
  }

  const ownedReleases = await tx
    .select({ id: bottleReleases.id, bottleId: bottleReleases.bottleId })
    .from(bottleReleases)
    .where(inArray(bottleReleases.bottleId, requestedBottleIds))
    .for("share");
  if (ownedReleases.length) {
    throw new ConcreteBottleMergeGraphError(
      "unmigrated",
      ownedReleases[0]!.bottleId,
    );
  }

  const targets = await tx
    .select()
    .from(catalogTargets)
    .where(inArray(catalogTargets.groupId, groupIds))
    .orderBy(asc(catalogTargets.groupId), asc(catalogTargets.id))
    .for("update");
  const exactTargetByBottleId = new Map(
    targets.flatMap((target) =>
      target.bottleId === null ? [] : [[target.bottleId, target] as const],
    ),
  );
  const genericTargetByGroupId = new Map(
    targets.flatMap((target) =>
      target.bottleId === null ? [[target.groupId, target] as const] : [],
    ),
  );
  const sourceExactTarget = exactTargetByBottleId.get(sourceBottleId);
  const destinationExactTarget = exactTargetByBottleId.get(destinationBottleId);
  const sourceGenericTarget = genericTargetByGroupId.get(sourceGroupId);
  const destinationGenericTarget =
    genericTargetByGroupId.get(destinationGroupId);
  if (
    !sourceExactTarget ||
    !destinationExactTarget ||
    !sourceGenericTarget ||
    !destinationGenericTarget ||
    targets.filter(
      ({ bottleId, groupId }) =>
        bottleId === null && groupIds.includes(groupId),
    ).length !== groupIds.length
  ) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      sourceBottleId,
    );
  }

  const sourceDistillers = await tx
    .select()
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, sourceBottleId))
    .orderBy(asc(bottlesToDistillers.distillerId))
    .for("share");
  const destinationDistillers = await tx
    .select()
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, destinationBottleId))
    .orderBy(asc(bottlesToDistillers.distillerId))
    .for("share");
  const groupDistillers = await tx
    .select()
    .from(bottleGroupDistillers)
    .where(inArray(bottleGroupDistillers.groupId, groupIds))
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    )
    .for("share");
  const sourceTags = await tx
    .select()
    .from(bottleTags)
    .where(eq(bottleTags.bottleId, sourceBottleId))
    .for("update");
  const sourceFlavorProfiles = await tx
    .select()
    .from(bottleFlavorProfiles)
    .where(eq(bottleFlavorProfiles.bottleId, sourceBottleId))
    .for("update");
  const destinationTagsBefore = await tx
    .select()
    .from(bottleTags)
    .where(eq(bottleTags.bottleId, destinationBottleId))
    .for("update");
  const destinationFlavorProfilesBefore = await tx
    .select()
    .from(bottleFlavorProfiles)
    .where(eq(bottleFlavorProfiles.bottleId, destinationBottleId))
    .for("update");
  const aliasesReferencingSource = await tx
    .select()
    .from(bottleAliases)
    .where(
      or(
        eq(bottleAliases.bottleId, sourceBottleId),
        eq(bottleAliases.targetId, sourceExactTarget.id),
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .for("update");
  const [canonicalAlias] = await tx
    .select()
    .from(bottleAliases)
    .where(sql`LOWER(${bottleAliases.name}) = LOWER(${source.fullName})`)
    .limit(1)
    .for("update");
  if (canonicalAlias) {
    const sourceBottleOwner = canonicalAlias.bottleId === sourceBottleId;
    const destinationBottleOwner =
      canonicalAlias.bottleId === destinationBottleId;
    const sourceExactTargetOwner =
      canonicalAlias.targetId === sourceExactTarget.id;
    const destinationExactTargetOwner =
      canonicalAlias.targetId === destinationExactTarget.id;
    const localBottleOwner = sourceBottleOwner || destinationBottleOwner;
    const localExactTargetOwner =
      sourceExactTargetOwner || destinationExactTargetOwner;
    // Generic/foreign ownership cannot become exact, and two populated local
    // channels must describe the same side of the merge.
    if (
      (canonicalAlias.bottleId !== null && !localBottleOwner) ||
      (canonicalAlias.targetId !== null && !localExactTargetOwner) ||
      (sourceBottleOwner && destinationExactTargetOwner) ||
      (destinationBottleOwner && sourceExactTargetOwner) ||
      (!localBottleOwner && !localExactTargetOwner)
    ) {
      throw new ConcreteBottleMergeConflictError("identity_conflict");
    }
  }
  const sourceAliases = aliasesReferencingSource.filter(
    ({ targetId }) => targetId !== sourceGenericTarget.id,
  );
  if (
    aliasesReferencingSource.some(
      ({ bottleId, targetId }) =>
        (bottleId === sourceBottleId &&
          targetId !== null &&
          targetId !== sourceExactTarget.id &&
          targetId !== sourceGenericTarget.id) ||
        (targetId === sourceExactTarget.id &&
          bottleId !== null &&
          bottleId !== sourceBottleId),
    )
  ) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      sourceBottleId,
    );
  }

  const promotionRows = await tx
    .select()
    .from(bottleReleasePromotions)
    .where(eq(bottleReleasePromotions.promotedBottleId, sourceBottleId))
    .orderBy(asc(bottleReleasePromotions.releaseId))
    .for("update");
  const mergeAudit = {
    sourceBottleId,
    sourceGroupId,
    destinationBottleId,
    destinationGroupId,
    actorId,
  };
  let promotionAuditUpdates: Array<{
    releaseId: number;
    auditMetadata: Record<string, unknown>;
  }>;
  try {
    promotionAuditUpdates = promotionRows.map((promotion) => ({
      releaseId: promotion.releaseId,
      auditMetadata: appendExactBottleMergePromotionEvent(
        promotion.auditMetadata,
        mergeAudit,
      ),
    }));
  } catch (error) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      sourceBottleId,
      { cause: error },
    );
  }
  const predecessorTombstones = await tx
    .select()
    .from(bottleTombstones)
    .where(eq(bottleTombstones.newBottleId, sourceBottleId))
    .orderBy(asc(bottleTombstones.bottleId))
    .for("update");
  const legacyConsumerPreimages = await loadLegacyConsumerPreimages(
    tx,
    sourceBottleId,
  );

  let exactConsumerPreimages;
  try {
    exactConsumerPreimages =
      await consolidateCatalogTargetConsumersInTransaction(tx, {
        sourceTargetId: sourceExactTarget.id,
        destinationTargetId: destinationExactTarget.id,
      });
  } catch (error) {
    if (error instanceof CatalogTargetConsumerConflictError) {
      throw new ConcreteBottleMergeConflictError("consumer_conflict", {
        cause: error,
      });
    }
    throw error;
  }

  let genericConsumerPreimages = null;
  const stableAliases = await tx
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.targetId, sourceGenericTarget.id))
    .orderBy(asc(bottleAliases.name))
    .for("update");
  let predecessorGroupTombstones: Array<{
    groupId: number;
    newGroupId: number;
    createdAt: Date;
    createdByActorId: number;
  }> = [];
  let predecessorBottleTombstonesBefore: BottleTombstone[] = [];
  if (crossGroup && sourceSingleton) {
    // Stable aliases keep generic intent while the legacy Bottle id follows the
    // surviving concrete destination during the dual-write window.
    await tx
      .update(bottleAliases)
      .set({
        targetId: destinationGenericTarget.id,
        bottleId: sql`CASE WHEN ${bottleAliases.bottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${bottleAliases.bottleId} END`,
      })
      .where(eq(bottleAliases.targetId, sourceGenericTarget.id));
    try {
      genericConsumerPreimages =
        await consolidateCatalogTargetConsumersInTransaction(tx, {
          sourceTargetId: sourceGenericTarget.id,
          destinationTargetId: destinationGenericTarget.id,
        });
    } catch (error) {
      if (error instanceof CatalogTargetConsumerConflictError) {
        throw new ConcreteBottleMergeConflictError("consumer_conflict", {
          cause: error,
        });
      }
      throw error;
    }
    predecessorGroupTombstones = await tx
      .select()
      .from(bottleGroupTombstones)
      .where(eq(bottleGroupTombstones.newGroupId, sourceGroupId))
      .orderBy(asc(bottleGroupTombstones.groupId))
      .for("update");
    predecessorBottleTombstonesBefore = await tx
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.newGroupId, sourceGroupId))
      .orderBy(asc(bottleTombstones.bottleId))
      .for("update");
  } else {
    await tx
      .update(bottleAliases)
      .set({ bottleId: null })
      .where(
        and(
          eq(bottleAliases.targetId, sourceGenericTarget.id),
          eq(bottleAliases.bottleId, sourceBottleId),
        ),
      );
  }

  const legacyCollectionPreimages = await consolidateLegacyCollectionRows(
    tx,
    sourceBottleId,
    destinationBottleId,
    destinationExactTarget.id,
  );
  const legacyFlightPreimages = await consolidateLegacyFlightRows(
    tx,
    sourceBottleId,
    destinationBottleId,
    destinationExactTarget.id,
  );
  try {
    await repointLegacyBottleConsumers(tx, sourceBottleId, destinationBottleId);
  } catch (error) {
    if (
      ["tasting_unq", "tasting_legacy_unq"].includes(
        postgresConstraint(error) ?? "",
      )
    ) {
      throw new ConcreteBottleMergeConflictError("consumer_conflict", {
        cause: error,
      });
    }
    throw error;
  }

  await tx
    .update(bottleAliases)
    .set({
      bottleId: destinationBottleId,
      targetId: destinationExactTarget.id,
    })
    .where(
      or(
        eq(bottleAliases.targetId, sourceExactTarget.id),
        and(
          eq(bottleAliases.bottleId, sourceBottleId),
          isNull(bottleAliases.targetId),
        ),
      ),
    );
  if (!canonicalAlias) {
    await tx.insert(bottleAliases).values({
      name: source.fullName,
      bottleId: destinationBottleId,
      targetId: destinationExactTarget.id,
      assignmentSource: "human_approved",
      assignedByActorId: actorId,
    });
  } else if (
    canonicalAlias.bottleId === destinationBottleId ||
    canonicalAlias.targetId === destinationExactTarget.id
  ) {
    await tx
      .update(bottleAliases)
      .set({
        bottleId: destinationBottleId,
        targetId: destinationExactTarget.id,
      })
      .where(eq(bottleAliases.name, canonicalAlias.name));
  }

  for (const promotion of promotionAuditUpdates) {
    await tx
      .update(bottleReleasePromotions)
      .set({
        promotedBottleId: destinationBottleId,
        auditMetadata: promotion.auditMetadata,
        updatedAt: new Date(),
      })
      .where(eq(bottleReleasePromotions.releaseId, promotion.releaseId));
  }

  for (const tag of sourceTags) {
    await tx
      .insert(bottleTags)
      .values({
        bottleId: destinationBottleId,
        tag: tag.tag,
        count: tag.count,
      })
      .onConflictDoUpdate({
        target: [bottleTags.bottleId, bottleTags.tag],
        set: { count: sql<number>`${bottleTags.count} + ${tag.count}` },
      });
  }
  for (const profile of sourceFlavorProfiles) {
    await tx
      .insert(bottleFlavorProfiles)
      .values({
        bottleId: destinationBottleId,
        flavorProfile: profile.flavorProfile,
        count: profile.count,
      })
      .onConflictDoUpdate({
        target: [
          bottleFlavorProfiles.bottleId,
          bottleFlavorProfiles.flavorProfile,
        ],
        set: {
          count: sql<number>`${bottleFlavorProfiles.count} + ${profile.count}`,
        },
      });
  }

  await tx
    .update(bottleTombstones)
    .set({ newBottleId: destinationBottleId })
    .where(eq(bottleTombstones.newBottleId, sourceBottleId));
  await tx.insert(bottleTombstones).values({
    bottleId: sourceBottleId,
    newBottleId: destinationBottleId,
  });

  if (sourceGroup.representativeBottleId === sourceBottleId) {
    // A retiring singleton must clear its representative before deletion;
    // same-group merges instead select the surviving member.
    await tx
      .update(bottleGroups)
      .set({
        representativeBottleId:
          crossGroup && sourceSingleton ? null : destinationBottleId,
      })
      .where(eq(bottleGroups.id, sourceGroupId));
  }

  await tx.delete(bottleTags).where(eq(bottleTags.bottleId, sourceBottleId));
  await tx
    .delete(bottleFlavorProfiles)
    .where(eq(bottleFlavorProfiles.bottleId, sourceBottleId));
  await tx
    .delete(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, sourceBottleId));
  await tx
    .delete(catalogTargets)
    .where(eq(catalogTargets.id, sourceExactTarget.id));
  await tx.delete(bottles).where(eq(bottles.id, sourceBottleId));

  if (crossGroup && sourceSingleton) {
    await tx
      .update(bottleTombstones)
      .set({ newGroupId: destinationGroupId })
      .where(eq(bottleTombstones.newGroupId, sourceGroupId));
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
  }

  const affectedGroupIds = crossGroup
    ? sourceSingleton
      ? [destinationGroupId]
      : [sourceGroupId, destinationGroupId]
    : [sourceGroupId];
  const groupStats = new Map<
    number,
    Awaited<ReturnType<typeof recomputeBottleGroupStatsInTransaction>>
  >();
  for (const groupId of affectedGroupIds) {
    groupStats.set(
      groupId,
      await recomputeBottleGroupStatsInTransaction(tx, groupId),
    );
  }
  const affectedSeriesIds = uniqueSorted([
    source.seriesId,
    destination.seriesId,
  ]);
  for (const seriesId of affectedSeriesIds) {
    await tx
      .update(bottleSeries)
      .set({
        numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId})`,
      })
      .where(eq(bottleSeries.id, seriesId));
  }

  const sourceAudit = {
    updateScope: "exact_merge",
    sourceBottleId,
    destinationBottleId,
    before: bottleSnapshot(
      source,
      sourceExactTarget.id,
      sourceDistillers.map(({ distillerId }) => distillerId),
    ),
    exactTargetBefore: sourceExactTarget,
    aliasesBefore: sourceAliases,
    promotionMappingsBefore: promotionRows,
    tagsBefore: sourceTags,
    flavorProfilesBefore: sourceFlavorProfiles,
    destinationTagsBefore,
    destinationFlavorProfilesBefore,
    exactConsumerPreimages,
    genericConsumerPreimages,
    legacyConsumerPreimages,
    legacyCollectionPreimages,
    legacyFlightPreimages,
    predecessorTombstones,
  };
  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: sourceBottleId,
    actorId,
    displayName: source.fullName,
    type: "delete",
    data: sourceAudit,
  });
  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: destinationBottleId,
    actorId,
    displayName: destination.fullName,
    type: "update",
    data: {
      updateScope: "exact_merge",
      sourceBottleId,
      destinationBottleId,
      before: bottleSnapshot(
        destination,
        destinationExactTarget.id,
        destinationDistillers.map(({ distillerId }) => distillerId),
      ),
      exactTarget: destinationExactTarget,
      after: bottleSnapshot(
        destination,
        destinationExactTarget.id,
        destinationDistillers.map(({ distillerId }) => distillerId),
      ),
    },
  });

  for (const groupId of groupIds) {
    const before = groupById.get(groupId)!;
    if (groupId === sourceGroupId && crossGroup && sourceSingleton) {
      await tx.insert(changes).values({
        objectType: "bottle_group",
        objectId: groupId,
        actorId,
        displayName: before.fullName,
        type: "delete",
        data: {
          updateScope: "exact_merge",
          sourceBottleId,
          destinationBottleId,
          before: groupSnapshot(before, sourceGenericTarget.id),
          genericTargetBefore: sourceGenericTarget,
          distillersBefore: groupDistillers.filter(
            ({ groupId }) => groupId === sourceGroupId,
          ),
          stableAliasesBefore: stableAliases,
          genericConsumerPreimages,
          predecessorGroupTombstones,
          predecessorBottleTombstonesBefore,
        },
      });
      continue;
    }
    const [after] = await tx
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, groupId))
      .limit(1);
    if (!after) {
      throw new ConcreteBottleMergeGraphError(
        "invalid_catalog_graph",
        groupId === sourceGroupId ? sourceBottleId : destinationBottleId,
      );
    }
    await tx.insert(changes).values({
      objectType: "bottle_group",
      objectId: groupId,
      actorId,
      displayName: after.fullName,
      type: "update",
      data: {
        updateScope: "exact_merge",
        sourceBottleId,
        destinationBottleId,
        before: groupSnapshot(
          before,
          groupId === sourceGroupId
            ? sourceGenericTarget.id
            : destinationGenericTarget.id,
        ),
        genericTarget:
          groupId === sourceGroupId
            ? sourceGenericTarget
            : destinationGenericTarget,
        distillersBefore: groupDistillers.filter(
          (row) => row.groupId === groupId,
        ),
        ...(groupId === sourceGroupId &&
        stableAliases.some(({ bottleId }) => bottleId === sourceBottleId)
          ? { stableAliasesBefore: stableAliases }
          : {}),
        after: groupSnapshot(
          after,
          groupId === sourceGroupId
            ? sourceGenericTarget.id
            : destinationGenericTarget.id,
        ),
        stats: groupStats.get(groupId),
      },
    });
  }

  const [destinationBottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, destinationBottleId))
    .limit(1);
  if (!destinationBottle) {
    throw new ConcreteBottleMergeGraphError(
      "invalid_catalog_graph",
      destinationBottleId,
    );
  }

  return {
    sourceBottleId,
    destinationBottleId,
    destinationBottle,
    destinationTargetId: destinationExactTarget.id,
    changed: true,
    aliasNames: Array.from(
      new Set([
        source.fullName,
        ...sourceAliases.map(({ name }) => name),
        ...stableAliases.map(({ name }) => name),
      ]),
    ).sort(),
    entityIds: uniqueSorted([
      source.brandId,
      source.bottlerId,
      destination.brandId,
      destination.bottlerId,
      ...sourceDistillers.map(({ distillerId }) => distillerId),
      ...destinationDistillers.map(({ distillerId }) => distillerId),
    ]),
    seriesIds: affectedSeriesIds,
  };
}

/** Dispatches only idempotent derived work after the outermost commit. */
export async function finalizeConcreteBottleMerge(
  manifest: ConcreteBottleMergeFinalizationManifest,
) {
  if (!manifest.changed) return;
  const jobs: Array<
    readonly [
      (
        | "OnBottleChange"
        | "OnBottleAliasChange"
        | "OnEntityChange"
        | "IndexBottleSeriesSearchVectors"
      ),
      Record<string, number | string>,
    ]
  > = [
    ["OnBottleChange", { targetId: manifest.destinationTargetId }],
    ...manifest.aliasNames.map(
      (name) => ["OnBottleAliasChange", { name }] as const,
    ),
    ...manifest.entityIds.map(
      (entityId) => ["OnEntityChange", { entityId }] as const,
    ),
    ...manifest.seriesIds.map(
      (seriesId) => ["IndexBottleSeriesSearchVectors", { seriesId }] as const,
    ),
  ];
  for (const [job, payload] of jobs) {
    try {
      await pushUniqueJob(job, payload);
    } catch (error) {
      logError(error, { extra: { job, ...payload } });
    }
  }
}

/** Authorizes, commits, and finalizes one exact Bottle duplicate merge. */
export async function mergeConcreteBottles({
  sourceBottleId,
  destinationBottleId,
  context,
}: {
  sourceBottleId: number;
  destinationBottleId: number;
  context: Context;
}): Promise<ConcreteBottleMergeResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new ConcreteBottleMergeAuthorizationError();
  }
  validateMergeInput(sourceBottleId, destinationBottleId);
  const user: User = context.user;
  const actor = await getUserActor(user);
  const manifest = await db.transaction((tx) =>
    mergeConcreteBottlesInTransaction(tx, {
      sourceBottleId,
      destinationBottleId,
      actorId: actor.id,
    }),
  );
  await finalizeConcreteBottleMerge(manifest);
  return {
    sourceBottleId,
    destinationBottleId,
    destinationBottle: manifest.destinationBottle,
    changed: manifest.changed,
  };
}
