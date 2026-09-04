import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import type { BottleGroup } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
} from "@peated/server/db/schema";
import { aggregateBottleActivityStatsInTransaction } from "@peated/server/lib/recomputeBottleActivityStats";
import { asc, eq, inArray, sql } from "drizzle-orm";

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
  | "reviewScoreBandCounts"
  | "tastingBandCounts"
  | "updatedAt"
>;

export type WrongBottleGroupBottleCount = {
  groupId: number;
  savedCount: number;
  actualCount: number;
};

type BottleCountQueryRow = {
  groupId: number | string;
  savedCount: number | string;
  actualCount: number | string;
};

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

async function findWrongBottleCounts(
  database: AnyDatabase,
  groupIds?: readonly number[],
): Promise<WrongBottleGroupBottleCount[]> {
  const ids = groupIds === undefined ? undefined : uniqueSorted(groupIds);
  if (ids?.length === 0) return [];
  const groupFilter = ids ? inArray(bottleGroups.id, ids) : sql`TRUE`;
  const bottleFilter = ids ? inArray(bottles.groupId, ids) : sql`TRUE`;

  const result = await database.execute<BottleCountQueryRow>(sql`
    WITH active_counts AS (
      SELECT ${bottles.groupId} AS group_id, COUNT(*) AS total
      FROM ${bottles}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${bottleFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
      GROUP BY ${bottles.groupId}
    )
    SELECT
      ${bottleGroups.id} AS "groupId",
      ${bottleGroups.totalBottles} AS "savedCount",
      COALESCE(active_counts.total, 0) AS "actualCount"
    FROM ${bottleGroups}
    LEFT JOIN active_counts ON active_counts.group_id = ${bottleGroups.id}
    WHERE ${groupFilter}
      AND ${bottleGroups.totalBottles} <> COALESCE(active_counts.total, 0)
    ORDER BY ${bottleGroups.id}
  `);

  return result.rows.map((row) => ({
    groupId: Number(row.groupId),
    savedCount: Number(row.savedCount),
    actualCount: Number(row.actualCount),
  }));
}

async function repairExistingBottleCount(
  tx: AnyTransaction,
  groupId: number,
): Promise<WrongBottleGroupBottleCount | null> {
  const [difference] = await findWrongBottleCounts(tx, [groupId]);
  if (!difference) return null;

  await tx
    .update(bottleGroups)
    .set({ totalBottles: difference.actualCount })
    .where(eq(bottleGroups.id, groupId));
  return difference;
}

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
      reviewScoreBandCounts: bottleGroups.reviewScoreBandCounts,
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

/** Checks saved BottleGroup totals against their active member Bottles. */
export async function checkBottleGroupBottleCounts(
  groupIds?: readonly number[],
): Promise<WrongBottleGroupBottleCount[]> {
  return findWrongBottleCounts(db, groupIds);
}

/** Locks and rechecks one BottleGroup before repairing only its Bottle total. */
export async function repairBottleGroupBottleCount(
  groupId: number,
): Promise<WrongBottleGroupBottleCount | null> {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select({ id: bottleGroups.id })
      .from(bottleGroups)
      .where(eq(bottleGroups.id, groupId))
      .for("update");
    if (!group) return null;

    return repairExistingBottleCount(tx, groupId);
  });
}
