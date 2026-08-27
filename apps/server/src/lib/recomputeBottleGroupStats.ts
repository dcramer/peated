import { db, type AnyTransaction } from "@peated/server/db";
import type { BottleGroup } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
} from "@peated/server/db/schema";
import { aggregateBottleActivityStatsInTransaction } from "@peated/server/lib/recomputeBottleActivityStats";
import { asc, eq, inArray } from "drizzle-orm";

export type BottleGroupStatsIntegrityErrorCode =
  | "not_found"
  | "invalid_catalog_graph";

export class BottleGroupStatsIntegrityError extends Error {
  constructor(
    readonly code: BottleGroupStatsIntegrityErrorCode,
    readonly groupId: number,
  ) {
    super(`Cannot recompute BottleGroup ${groupId} statistics: ${code}.`);
    this.name = "BottleGroupStatsIntegrityError";
  }
}

export type BottleGroupStatsResult = Pick<
  BottleGroup,
  | "id"
  | "totalBottles"
  | "totalTastings"
  | "medianScore"
  | "minScore"
  | "maxScore"
  | "memberScoreCount"
  | "externalScoreCount"
  | "tastingBandCounts"
  | "updatedAt"
>;

/** Recomputes one active group from direct activity on its member Bottles. */
export async function recomputeBottleGroupStatsInTransaction(
  tx: AnyTransaction,
  groupId: number,
): Promise<BottleGroupStatsResult> {
  const [group] = await tx
    .select({ id: bottleGroups.id })
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1)
    .for("update");
  if (!group) {
    throw new BottleGroupStatsIntegrityError("not_found", groupId);
  }

  const members = await tx
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id))
    .for("share");
  const retiredMembers = members.length
    ? await tx
        .select({ bottleId: bottleTombstones.bottleId })
        .from(bottleTombstones)
        .where(
          inArray(
            bottleTombstones.bottleId,
            members.map(({ id }) => id),
          ),
        )
    : [];
  const retiredBottleIds = new Set(
    retiredMembers.map(({ bottleId }) => bottleId),
  );
  const activeMembers = members.filter(({ id }) => !retiredBottleIds.has(id));
  if (!activeMembers.length) {
    throw new BottleGroupStatsIntegrityError("invalid_catalog_graph", groupId);
  }

  const stats = await aggregateBottleActivityStatsInTransaction(
    tx,
    activeMembers.map(({ id }) => id),
  );

  const [persisted] = await tx
    .update(bottleGroups)
    .set({
      totalBottles: activeMembers.length,
      ...stats,
      updatedAt: new Date(),
    })
    .where(eq(bottleGroups.id, groupId))
    .returning({
      id: bottleGroups.id,
      totalBottles: bottleGroups.totalBottles,
      totalTastings: bottleGroups.totalTastings,
      medianScore: bottleGroups.medianScore,
      minScore: bottleGroups.minScore,
      maxScore: bottleGroups.maxScore,
      memberScoreCount: bottleGroups.memberScoreCount,
      externalScoreCount: bottleGroups.externalScoreCount,
      tastingBandCounts: bottleGroups.tastingBandCounts,
      updatedAt: bottleGroups.updatedAt,
    });
  if (!persisted) {
    throw new BottleGroupStatsIntegrityError("invalid_catalog_graph", groupId);
  }
  return persisted;
}

/** Owns the transaction for a BottleGroup statistics recomputation. */
export async function recomputeBottleGroupStats(
  groupId: number,
): Promise<BottleGroupStatsResult> {
  return await db.transaction((tx) =>
    recomputeBottleGroupStatsInTransaction(tx, groupId),
  );
}
