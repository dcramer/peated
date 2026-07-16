import { db, type AnyTransaction } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleGroupTombstones,
  bottleTombstones,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import { aggregateCatalogTargetStatsInTransaction } from "@peated/server/lib/recomputeCatalogTargetStats";
import { eq } from "drizzle-orm";

export type BottleStatsIntegrityErrorCode =
  | "not_found"
  | "retired"
  | "unmigrated"
  | "invalid_catalog_graph";

export class BottleStatsIntegrityError extends Error {
  constructor(
    readonly code: BottleStatsIntegrityErrorCode,
    readonly bottleId: number,
  ) {
    super(`Cannot recompute Bottle ${bottleId} statistics: ${code}.`);
    this.name = "BottleStatsIntegrityError";
  }
}

export type BottleStatsResult = Pick<
  Bottle,
  "id" | "groupId" | "totalTastings" | "avgRating" | "ratingStats" | "updatedAt"
>;

async function bottleRetired(tx: AnyTransaction, bottleId: number) {
  const [tombstone] = await tx
    .select({ bottleId: bottleTombstones.bottleId })
    .from(bottleTombstones)
    .where(eq(bottleTombstones.bottleId, bottleId))
    .limit(1)
    .for("update");
  return tombstone !== undefined;
}

/** Recomputes one active Bottle from only its exact target activity. */
export async function recomputeBottleStatsInTransaction(
  tx: AnyTransaction,
  bottleId: number,
): Promise<BottleStatsResult> {
  if (await bottleRetired(tx, bottleId)) {
    throw new BottleStatsIntegrityError("retired", bottleId);
  }

  const [bottle] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1)
    .for("update");
  if (!bottle) {
    throw new BottleStatsIntegrityError("not_found", bottleId);
  }
  if (bottle.groupId === null) {
    throw new BottleStatsIntegrityError("unmigrated", bottleId);
  }

  const [retiredGroup] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, bottle.groupId))
    .limit(1);
  if (retiredGroup) {
    throw new BottleStatsIntegrityError("invalid_catalog_graph", bottleId);
  }

  const exactTargets = await tx
    .select({ id: catalogTargets.id, groupId: catalogTargets.groupId })
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottleId))
    .for("share");
  if (
    exactTargets.length !== 1 ||
    exactTargets[0]!.groupId !== bottle.groupId
  ) {
    throw new BottleStatsIntegrityError("invalid_catalog_graph", bottleId);
  }

  const stats = await aggregateCatalogTargetStatsInTransaction(tx, [
    exactTargets[0]!.id,
  ]);
  const [persisted] = await tx
    .update(bottles)
    .set({ ...stats, updatedAt: new Date() })
    .where(eq(bottles.id, bottleId))
    .returning({
      id: bottles.id,
      groupId: bottles.groupId,
      totalTastings: bottles.totalTastings,
      avgRating: bottles.avgRating,
      ratingStats: bottles.ratingStats,
      updatedAt: bottles.updatedAt,
    });
  if (!persisted) {
    throw new BottleStatsIntegrityError("invalid_catalog_graph", bottleId);
  }
  return persisted;
}

/** Owns the transaction for an exact Bottle statistics recomputation. */
export async function recomputeBottleStats(
  bottleId: number,
): Promise<BottleStatsResult> {
  return await db.transaction((tx) =>
    recomputeBottleStatsInTransaction(tx, bottleId),
  );
}
