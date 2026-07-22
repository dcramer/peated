/**
 * Authoritative consumer-only target consolidation. The caller owns the
 * transaction and target lifecycle. Collection and flight collisions collapse
 * destination-wins, while tasting collisions throw for transaction rollback.
 * Returned consumer preimages support caller-owned audit and reversal.
 */

import type { AnyTransaction } from "@peated/server/db";
import {
  bottleObservations,
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
import { and, asc, eq, or, sql } from "drizzle-orm";

export class CatalogTargetConsumerConsolidationInputError extends Error {
  constructor() {
    super("Catalog target consolidation requires distinct target IDs.");
    this.name = "CatalogTargetConsumerConsolidationInputError";
  }
}

export class CatalogTargetConsumerConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Catalog target consumers cannot be consolidated.", options);
    this.name = "CatalogTargetConsumerConflictError";
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
            eq(flightBottles.targetId, sourceTargetId),
            source.bottleId === null
              ? sql`${flightBottles.bottleId} IS NULL`
              : eq(flightBottles.bottleId, source.bottleId),
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
          eq(flightBottles.targetId, sourceTargetId),
          source.bottleId === null
            ? sql`${flightBottles.bottleId} IS NULL`
            : eq(flightBottles.bottleId, source.bottleId),
          source.releaseId === null
            ? sql`${flightBottles.releaseId} IS NULL`
            : eq(flightBottles.releaseId, source.releaseId),
        ),
      );
  }

  return sourceRows;
}

/** Coordinates consumer mutations and their preimages in the caller's transaction. */
async function consolidateCatalogTargetConsumers(
  tx: AnyTransaction,
  {
    sourceTargetId,
    destinationTargetId,
  }: {
    sourceTargetId: number;
    destinationTargetId: number;
  },
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
    throw new CatalogTargetConsumerConflictError();
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

/**
 * Destructively repoints source consumers and collapses collection and flight
 * duplicates in favor of destination rows. Returns mutation preimages and
 * throws on tasting uniqueness; the caller owns rollback and target lifecycle.
 */
export async function consolidateCatalogTargetConsumersInTransaction(
  tx: AnyTransaction,
  {
    sourceTargetId,
    destinationTargetId,
  }: {
    sourceTargetId: number;
    destinationTargetId: number;
  },
) {
  if (sourceTargetId === destinationTargetId) {
    throw new CatalogTargetConsumerConsolidationInputError();
  }

  try {
    return await consolidateCatalogTargetConsumers(tx, {
      sourceTargetId,
      destinationTargetId,
    });
  } catch (error) {
    if (postgresConstraint(error) === "tasting_target_unq") {
      throw new CatalogTargetConsumerConflictError({ cause: error });
    }
    throw error;
  }
}
