/**
 * Owns exact-Bottle duplicate merges. The selected destination remains the
 * complete authoritative Bottle; consumer identity never passes through a
 * BottleGroup or another catalog target.
 */
import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleBarcodes,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleObservations,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
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
import { logError } from "@peated/server/lib/log";
import { recomputeBottleGroupStatsInTransaction } from "@peated/server/lib/recomputeBottleGroupStats";
import { recomputeBottleStatsInTransaction } from "@peated/server/lib/recomputeBottleStats";
import type { Context } from "@peated/server/orpc/context";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

export class BottleMergeAuthorizationError extends Error {
  constructor() {
    super("Moderator authorization is required to merge Bottles.");
    this.name = "BottleMergeAuthorizationError";
  }
}

export class BottleMergeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BottleMergeInputError";
  }
}

export type BottleMergeGraphErrorCode =
  | "not_found"
  | "retired"
  | "unmigrated"
  | "invalid_catalog_graph";

export class BottleMergeGraphError extends Error {
  constructor(
    readonly code: BottleMergeGraphErrorCode,
    readonly bottleId: number,
    options?: ErrorOptions,
  ) {
    super(`Cannot merge Bottle ${bottleId}: ${code}.`, options);
    this.name = "BottleMergeGraphError";
  }
}

export type BottleMergeConflictCode =
  | "same_bottle"
  | "retired_to_other_destination"
  | "identity_conflict"
  | "consumer_conflict";

export class BottleMergeConflictError extends Error {
  constructor(
    readonly code: BottleMergeConflictCode,
    options?: ErrorOptions,
  ) {
    super(`Bottle merge failed: ${code}.`, options);
    this.name = "BottleMergeConflictError";
  }
}

export type BottleMergeResult = {
  sourceBottleId: number;
  destinationBottleId: number;
  destinationBottle: Bottle;
  changed: boolean;
};

export type BottleMergeFinalizationManifest = BottleMergeResult & {
  aliasNames: string[];
  entityIds: number[];
  seriesIds: number[];
};

function inertManifest(
  sourceBottleId: number,
  destinationBottle: Bottle,
): BottleMergeFinalizationManifest {
  return {
    sourceBottleId,
    destinationBottleId: destinationBottle.id,
    destinationBottle,
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
    throw new BottleMergeInputError(
      "Source Bottle ID must be a positive integer.",
    );
  }
  if (!Number.isInteger(destinationBottleId) || destinationBottleId <= 0) {
    throw new BottleMergeInputError(
      "Destination Bottle ID must be a positive integer.",
    );
  }
  if (sourceBottleId === destinationBottleId) {
    throw new BottleMergeConflictError("same_bottle");
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

async function consolidateCollectionMemberships(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
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
  const rowsByCollectionId = new Map<number, typeof rows>();
  for (const row of rows) {
    const collectionRows = rowsByCollectionId.get(row.collectionId);
    if (collectionRows) collectionRows.push(row);
    else rowsByCollectionId.set(row.collectionId, [row]);
  }

  const changedCollectionIds = new Set<number>();
  let moved = 0;
  let collapsed = 0;

  for (const collectionRows of rowsByCollectionId.values()) {
    const preferredRows = [
      ...collectionRows.filter(
        ({ bottleId }) => bottleId === destinationBottleId,
      ),
      ...collectionRows.filter(({ bottleId }) => bottleId === sourceBottleId),
    ];
    const survivor = preferredRows[0]!;
    const imageUrl = survivor.imageUrl?.trim()
      ? survivor.imageUrl
      : (preferredRows.find(({ imageUrl }) => imageUrl?.trim())?.imageUrl ??
        survivor.imageUrl);

    for (const row of collectionRows) {
      if (row.id === survivor.id) continue;
      await tx
        .delete(collectionBottles)
        .where(eq(collectionBottles.id, row.id));
      changedCollectionIds.add(row.collectionId);
      collapsed += 1;
    }

    await tx
      .update(collectionBottles)
      .set({ bottleId: destinationBottleId, imageUrl })
      .where(eq(collectionBottles.id, survivor.id));
    if (survivor.bottleId === sourceBottleId) moved += 1;
  }

  for (const collectionId of changedCollectionIds) {
    await tx
      .update(collections)
      .set({
        totalBottles: sql`(SELECT COUNT(*) FROM ${collectionBottles} WHERE ${collectionBottles.collectionId} = ${collectionId})`,
      })
      .where(eq(collections.id, collectionId));
  }
  return { moved, collapsed };
}

async function consolidateFlightMemberships(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  const rows = await tx
    .select()
    .from(flightBottles)
    .where(
      inArray(flightBottles.bottleId, [sourceBottleId, destinationBottleId]),
    )
    .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId))
    .for("update");
  const rowsByFlightId = new Map<number, typeof rows>();
  for (const row of rows) {
    const flightRows = rowsByFlightId.get(row.flightId);
    if (flightRows) flightRows.push(row);
    else rowsByFlightId.set(row.flightId, [row]);
  }

  let moved = 0;
  let collapsed = 0;

  for (const flightRows of rowsByFlightId.values()) {
    const preferredRows = [
      ...flightRows.filter(({ bottleId }) => bottleId === destinationBottleId),
      ...flightRows.filter(({ bottleId }) => bottleId === sourceBottleId),
    ];
    const survivor = preferredRows[0]!;
    for (const row of flightRows) {
      if (row === survivor) continue;
      await tx
        .delete(flightBottles)
        .where(
          and(
            eq(flightBottles.flightId, row.flightId),
            eq(flightBottles.bottleId, row.bottleId),
          ),
        );
      collapsed += 1;
    }

    if (survivor.bottleId === sourceBottleId) {
      await tx
        .update(flightBottles)
        .set({ bottleId: destinationBottleId })
        .where(
          and(
            eq(flightBottles.flightId, survivor.flightId),
            eq(flightBottles.bottleId, sourceBottleId),
          ),
        );
      moved += 1;
    }
  }
  return { moved, collapsed };
}

async function assertNoTastingCollision(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  const rows = await tx
    .select({
      bottleId: tastings.bottleId,
      createdById: tastings.createdById,
      createdAt: tastings.createdAt,
    })
    .from(tastings)
    .where(inArray(tastings.bottleId, [sourceBottleId, destinationBottleId]))
    .orderBy(asc(tastings.createdById), asc(tastings.createdAt))
    .for("update");
  const projectedKeys = new Set<string>();
  for (const { createdById, createdAt } of rows) {
    const key = `${createdById}:${createdAt.getTime()}`;
    if (projectedKeys.has(key)) {
      throw new BottleMergeConflictError("consumer_conflict");
    }
    projectedKeys.add(key);
  }
}

async function repointBottleConsumers(
  tx: AnyTransaction,
  sourceBottleId: number,
  destinationBottleId: number,
) {
  await assertNoTastingCollision(tx, sourceBottleId, destinationBottleId);
  const collectionMemberships = await consolidateCollectionMemberships(
    tx,
    sourceBottleId,
    destinationBottleId,
  );
  const flightMemberships = await consolidateFlightMemberships(
    tx,
    sourceBottleId,
    destinationBottleId,
  );

  const counts: Record<string, number> = {
    collectionMembershipsMoved: collectionMemberships.moved,
    collectionMembershipsCollapsed: collectionMemberships.collapsed,
    flightMembershipsMoved: flightMemberships.moved,
    flightMembershipsCollapsed: flightMemberships.collapsed,
  };
  for (const [name, table, column] of [
    ["tastings", tastings, tastings.bottleId],
    ["reviews", reviews, reviews.bottleId],
    ["storePrices", storePrices, storePrices.bottleId],
    ["bottleObservations", bottleObservations, bottleObservations.bottleId],
    ["bottleBarcodes", bottleBarcodes, bottleBarcodes.bottleId],
    [
      "incomingBottleDecisionLogs",
      incomingBottleDecisionLogs,
      incomingBottleDecisionLogs.bottleId,
    ],
  ] as const) {
    const updated = await tx
      .update(table)
      .set({ bottleId: destinationBottleId })
      .where(eq(column, sourceBottleId))
      .returning({ id: table.id });
    counts[name] = updated.length;
  }

  for (const [name, table] of [
    ["storePriceMatchProposals", storePriceMatchProposals],
    ["storePriceMatchAttempts", storePriceMatchAttempts],
  ] as const) {
    const updated = await tx
      .update(table)
      .set({
        currentBottleId: sql`CASE WHEN ${table.currentBottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${table.currentBottleId} END`,
        suggestedBottleId: sql`CASE WHEN ${table.suggestedBottleId} = ${sourceBottleId} THEN ${destinationBottleId} ELSE ${table.suggestedBottleId} END`,
        updatedAt: new Date(),
      })
      .where(
        or(
          eq(table.currentBottleId, sourceBottleId),
          eq(table.suggestedBottleId, sourceBottleId),
        ),
      )
      .returning({ id: table.id });
    counts[name] = updated.length;
  }
  return counts;
}

/**
 * Locks every row represented by the Bottle-merge state token. New dependent
 * rows are blocked by the owning Bottle locks, so preparation remains stable
 * until the caller executes or rolls back.
 */
export async function lockBottleMergeDependencies(
  tx: AnyTransaction,
  {
    sourceBottleId,
    destinationBottleId,
  }: {
    sourceBottleId: number;
    destinationBottleId: number;
  },
) {
  validateMergeInput(sourceBottleId, destinationBottleId);
  const bottleIds = [sourceBottleId, destinationBottleId].sort(
    (left, right) => left - right,
  );
  const discovered = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(inArray(bottles.id, bottleIds))
    .orderBy(asc(bottles.id));
  const groupIds = uniqueSorted(discovered.map(({ groupId }) => groupId));
  const groups = groupIds.length
    ? await tx
        .select({ id: bottleGroups.id })
        .from(bottleGroups)
        .where(inArray(bottleGroups.id, groupIds))
        .orderBy(asc(bottleGroups.id))
        .for("update")
    : [];
  const members = groups.length
    ? await tx
        .select({ id: bottles.id })
        .from(bottles)
        .where(
          inArray(
            bottles.groupId,
            groups.map(({ id }) => id),
          ),
        )
        .orderBy(asc(bottles.id))
        .for("update")
    : [];
  const memberIds = members.map(({ id }) => id);

  await tx
    .select()
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, bottleIds))
    .orderBy(asc(bottleTombstones.bottleId))
    .for("update");
  if (memberIds.length) {
    await tx
      .select()
      .from(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, memberIds))
      .orderBy(
        asc(bottlesToDistillers.bottleId),
        asc(bottlesToDistillers.distillerId),
      )
      .for("update");
  }
  if (groupIds.length) {
    await tx
      .select()
      .from(bottleGroupDistillers)
      .where(inArray(bottleGroupDistillers.groupId, groupIds))
      .orderBy(
        asc(bottleGroupDistillers.groupId),
        asc(bottleGroupDistillers.distillerId),
      )
      .for("update");
  }
  await tx
    .select()
    .from(bottleAliases)
    .where(inArray(bottleAliases.bottleId, bottleIds))
    .orderBy(asc(bottleAliases.name))
    .for("update");
  await tx
    .select()
    .from(tastings)
    .where(inArray(tastings.bottleId, bottleIds))
    .orderBy(asc(tastings.id))
    .for("update");
  await tx
    .select()
    .from(collectionBottles)
    .where(inArray(collectionBottles.bottleId, bottleIds))
    .orderBy(asc(collectionBottles.collectionId), asc(collectionBottles.id))
    .for("update");
  await tx
    .select()
    .from(flightBottles)
    .where(inArray(flightBottles.bottleId, bottleIds))
    .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId))
    .for("update");
  await tx
    .select()
    .from(reviews)
    .where(inArray(reviews.bottleId, bottleIds))
    .orderBy(asc(reviews.id))
    .for("update");
  await tx
    .select()
    .from(storePrices)
    .where(inArray(storePrices.bottleId, bottleIds))
    .orderBy(asc(storePrices.id))
    .for("update");
  await tx
    .select()
    .from(bottleObservations)
    .where(inArray(bottleObservations.bottleId, bottleIds))
    .orderBy(asc(bottleObservations.id))
    .for("update");
  await tx
    .select()
    .from(incomingBottleDecisionLogs)
    .where(inArray(incomingBottleDecisionLogs.bottleId, bottleIds))
    .orderBy(asc(incomingBottleDecisionLogs.id))
    .for("update");
  await tx
    .select()
    .from(storePriceMatchProposals)
    .where(
      or(
        inArray(storePriceMatchProposals.currentBottleId, bottleIds),
        inArray(storePriceMatchProposals.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchProposals.id))
    .for("update");
  await tx
    .select()
    .from(storePriceMatchAttempts)
    .where(
      or(
        inArray(storePriceMatchAttempts.currentBottleId, bottleIds),
        inArray(storePriceMatchAttempts.suggestedBottleId, bottleIds),
      ),
    )
    .orderBy(asc(storePriceMatchAttempts.id))
    .for("update");
  await tx
    .select()
    .from(bottleTags)
    .where(inArray(bottleTags.bottleId, bottleIds))
    .orderBy(asc(bottleTags.bottleId), asc(bottleTags.tag))
    .for("update");
  await tx
    .select()
    .from(bottleFlavorProfiles)
    .where(inArray(bottleFlavorProfiles.bottleId, bottleIds))
    .orderBy(
      asc(bottleFlavorProfiles.bottleId),
      asc(bottleFlavorProfiles.flavorProfile),
    )
    .for("update");
}

/**
 * Commits one exact duplicate merge inside the caller-owned transaction. The
 * returned manifest must only be finalized after the outermost commit.
 */
export async function mergeBottlesInTransaction(
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
): Promise<BottleMergeFinalizationManifest> {
  validateMergeInput(sourceBottleId, destinationBottleId);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new BottleMergeInputError("Actor ID must be a positive integer.");
  }

  const requestedBottleIds = [sourceBottleId, destinationBottleId].sort(
    (left, right) => left - right,
  );
  const discoveredBottles = await tx
    .select({ id: bottles.id, groupId: bottles.groupId })
    .from(bottles)
    .where(inArray(bottles.id, requestedBottleIds))
    .orderBy(asc(bottles.id));
  const discoveredById = new Map(
    discoveredBottles.map((bottle) => [bottle.id, bottle]),
  );
  const discoveredSource = discoveredById.get(sourceBottleId);
  const discoveredDestination = discoveredById.get(destinationBottleId);
  if (discoveredSource?.groupId === null) {
    throw new BottleMergeGraphError("unmigrated", sourceBottleId);
  }
  if (discoveredDestination?.groupId === null) {
    throw new BottleMergeGraphError("unmigrated", destinationBottleId);
  }

  const groupIds = uniqueSorted([
    discoveredSource?.groupId ?? null,
    discoveredDestination?.groupId ?? null,
  ]);
  const groups = groupIds.length
    ? await tx
        .select()
        .from(bottleGroups)
        .where(inArray(bottleGroups.id, groupIds))
        .orderBy(asc(bottleGroups.id))
        .for("update")
    : [];
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const lockedMembers = groupIds.length
    ? await tx
        .select()
        .from(bottles)
        .where(inArray(bottles.groupId, groupIds))
        .orderBy(asc(bottles.id))
        .for("update")
    : [];
  const bottleById = new Map(
    lockedMembers.map((bottle) => [bottle.id, bottle]),
  );
  const source = bottleById.get(sourceBottleId);
  const destination = bottleById.get(destinationBottleId);
  const tombstones = await tx
    .select()
    .from(bottleTombstones)
    .where(inArray(bottleTombstones.bottleId, requestedBottleIds))
    .orderBy(asc(bottleTombstones.bottleId))
    .for("update");
  const tombstoneByBottleId = new Map(
    tombstones.map((tombstone) => [tombstone.bottleId, tombstone]),
  );

  if (tombstoneByBottleId.has(destinationBottleId)) {
    throw new BottleMergeGraphError("retired", destinationBottleId);
  }
  const sourceTombstone = tombstoneByBottleId.get(sourceBottleId);
  if (sourceTombstone?.newBottleId === destinationBottleId) {
    if (!destination || destination.groupId === null) {
      throw new BottleMergeGraphError(
        "invalid_catalog_graph",
        destinationBottleId,
      );
    }
    const destinationGroup = groupById.get(destination.groupId);
    if (
      !destinationGroup ||
      destinationGroup.representativeBottleId === null ||
      !lockedMembers.some(
        ({ id, groupId }) =>
          id === destinationGroup.representativeBottleId &&
          groupId === destinationGroup.id,
      )
    ) {
      throw new BottleMergeGraphError(
        "invalid_catalog_graph",
        destinationBottleId,
      );
    }
    return inertManifest(sourceBottleId, destination);
  }
  if (sourceTombstone) {
    throw new BottleMergeConflictError("retired_to_other_destination");
  }
  if (!source) {
    throw new BottleMergeGraphError(
      discoveredSource ? "invalid_catalog_graph" : "not_found",
      sourceBottleId,
    );
  }
  if (!destination) {
    throw new BottleMergeGraphError(
      discoveredDestination ? "invalid_catalog_graph" : "not_found",
      destinationBottleId,
    );
  }
  if (source.groupId === null) {
    throw new BottleMergeGraphError("unmigrated", sourceBottleId);
  }
  if (destination.groupId === null) {
    throw new BottleMergeGraphError("unmigrated", destinationBottleId);
  }
  if (
    source.groupId !== discoveredSource?.groupId ||
    destination.groupId !== discoveredDestination?.groupId
  ) {
    throw new BottleMergeGraphError(
      "invalid_catalog_graph",
      source.groupId !== discoveredSource?.groupId
        ? sourceBottleId
        : destinationBottleId,
    );
  }

  const sourceGroupId = source.groupId;
  const destinationGroupId = destination.groupId;
  const sourceGroup = groupById.get(sourceGroupId);
  const destinationGroup = groupById.get(destinationGroupId);
  if (!sourceGroup || !destinationGroup) {
    throw new BottleMergeGraphError(
      "invalid_catalog_graph",
      !sourceGroup ? sourceBottleId : destinationBottleId,
    );
  }
  const sourceMembers = lockedMembers.filter(
    ({ groupId }) => groupId === sourceGroupId,
  );
  const destinationMembers = lockedMembers.filter(
    ({ groupId }) => groupId === destinationGroupId,
  );
  if (
    sourceGroup.representativeBottleId === null ||
    !sourceMembers.some(
      ({ id }) => id === sourceGroup.representativeBottleId,
    ) ||
    destinationGroup.representativeBottleId === null ||
    !destinationMembers.some(
      ({ id }) => id === destinationGroup.representativeBottleId,
    )
  ) {
    throw new BottleMergeGraphError("invalid_catalog_graph", sourceBottleId);
  }
  const crossGroup = sourceGroupId !== destinationGroupId;
  const survivingSourceMembers = sourceMembers.filter(
    ({ id }) => id !== sourceBottleId,
  );
  const sourceSingleton = survivingSourceMembers.length === 0;
  const survivingSourceRepresentative = survivingSourceMembers[0];

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
  const sourceAliases = await tx
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, sourceBottleId))
    .orderBy(asc(bottleAliases.name))
    .for("update");
  const [canonicalAlias] = await tx
    .select()
    .from(bottleAliases)
    .where(sql`LOWER(${bottleAliases.name}) = LOWER(${source.fullName})`)
    .limit(1)
    .for("update");
  const canonicalAliasOwnerId = canonicalAlias?.bottleId;
  if (
    typeof canonicalAliasOwnerId === "number" &&
    !bottleById.has(canonicalAliasOwnerId)
  ) {
    throw new BottleMergeConflictError("identity_conflict");
  }

  let consumerCounts: Record<string, number>;
  try {
    consumerCounts = await repointBottleConsumers(
      tx,
      sourceBottleId,
      destinationBottleId,
    );
  } catch (error) {
    if (
      ["tasting_unq", "tasting_legacy_unq"].includes(
        postgresConstraint(error) ?? "",
      )
    ) {
      throw new BottleMergeConflictError("consumer_conflict", {
        cause: error,
      });
    }
    throw error;
  }

  await tx
    .update(bottleAliases)
    .set({ bottleId: destinationBottleId })
    .where(eq(bottleAliases.bottleId, sourceBottleId));
  if (!canonicalAlias) {
    await tx.insert(bottleAliases).values({
      name: source.fullName,
      bottleId: destinationBottleId,
      assignmentSource: "human_approved",
      assignedByActorId: actorId,
    });
  } else if (canonicalAlias.bottleId === null) {
    await tx
      .update(bottleAliases)
      .set({
        name: source.fullName,
        bottleId: destinationBottleId,
        ignored: false,
        embedding: null,
        assignmentSource: "human_approved",
        assignedByActorId: actorId,
      })
      .where(eq(bottleAliases.name, canonicalAlias.name));
  }

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
    await tx
      .update(bottleGroups)
      .set({
        representativeBottleId: crossGroup
          ? (survivingSourceRepresentative?.id ?? null)
          : destinationBottleId,
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
  await tx.delete(bottles).where(eq(bottles.id, sourceBottleId));

  if (crossGroup && sourceSingleton) {
    await tx
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, sourceGroupId));
    await tx.delete(bottleGroups).where(eq(bottleGroups.id, sourceGroupId));
  }

  await recomputeBottleStatsInTransaction(tx, destinationBottleId);
  const affectedGroupIds = crossGroup
    ? sourceSingleton
      ? [destinationGroupId]
      : [sourceGroupId, destinationGroupId]
    : [sourceGroupId];
  for (const groupId of affectedGroupIds) {
    await recomputeBottleGroupStatsInTransaction(tx, groupId);
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

  const auditData = {
    updateScope: "exact_merge",
    sourceBottleId,
    destinationBottleId,
    sourceGroupId,
    destinationGroupId,
    sourceBefore: source,
    destinationBefore: destination,
    sourceAliasNames: sourceAliases.map(({ name }) => name),
    consumerCounts,
  };
  for (const before of groups) {
    const [after] = await tx
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, before.id))
      .limit(1);
    await tx.insert(changes).values({
      objectType: "bottle_group",
      objectId: before.id,
      actorId,
      displayName: before.fullName,
      type: after ? "update" : "delete",
      data: {
        updateScope: "exact_merge",
        sourceBottleId,
        destinationBottleId,
        before,
        after: after ?? null,
        ...(after ? {} : { replacementGroupId: destinationGroupId }),
      },
    });
  }
  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: sourceBottleId,
    actorId,
    displayName: source.fullName,
    type: "delete",
    data: auditData,
  });

  const [destinationBottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, destinationBottleId))
    .limit(1);
  if (!destinationBottle) {
    throw new BottleMergeGraphError(
      "invalid_catalog_graph",
      destinationBottleId,
    );
  }
  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: destinationBottleId,
    actorId,
    displayName: destinationBottle.fullName,
    type: "update",
    data: {
      ...auditData,
      destinationAfter: destinationBottle,
    },
  });

  return {
    sourceBottleId,
    destinationBottleId,
    destinationBottle,
    changed: true,
    aliasNames: Array.from(
      new Set([source.fullName, ...sourceAliases.map(({ name }) => name)]),
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
export async function finalizeBottleMerge(
  manifest: BottleMergeFinalizationManifest,
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
    ["OnBottleChange", { bottleId: manifest.destinationBottleId }],
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
export async function mergeBottles({
  sourceBottleId,
  destinationBottleId,
  context,
}: {
  sourceBottleId: number;
  destinationBottleId: number;
  context: Context;
}): Promise<BottleMergeResult> {
  if (!context.user?.admin && !context.user?.mod) {
    throw new BottleMergeAuthorizationError();
  }
  validateMergeInput(sourceBottleId, destinationBottleId);
  const user: User = context.user;
  const actor = await getUserActor(user);
  const manifest = await db.transaction((tx) =>
    mergeBottlesInTransaction(tx, {
      sourceBottleId,
      destinationBottleId,
      actorId: actor.id,
    }),
  );
  await finalizeBottleMerge(manifest);
  return {
    sourceBottleId,
    destinationBottleId,
    destinationBottle: manifest.destinationBottle,
    changed: manifest.changed,
  };
}
