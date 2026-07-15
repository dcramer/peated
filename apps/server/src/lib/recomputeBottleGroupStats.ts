import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import type { AnyTransaction } from "@peated/server/db";
import type { BottleGroup } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import { asc, eq, inArray, sql } from "drizzle-orm";

export type BottleGroupStatsIntegrityErrorCode =
  | "not_found"
  | "retired"
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
  | "avgRating"
  | "ratingStats"
  | "updatedAt"
>;

type RawRatingStats = {
  pass: number | string;
  sip: number | string;
  savor: number | string;
  total: number | string;
  totalTastings: number | string;
  avg: number | string | null;
};

function countValue(value: number | string): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function averageValue(value: number | string | null): number | null {
  if (value === null) return null;
  const average = Number(value);
  return Number.isFinite(average) ? average : null;
}

/** Recomputes one active group from canonical target activity inside the caller's transaction. */
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
  const [tombstone] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, groupId))
    .limit(1);

  if (tombstone) {
    throw new BottleGroupStatsIntegrityError("retired", groupId);
  }
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

  const targets = await tx
    .select({
      id: catalogTargets.id,
      bottleId: catalogTargets.bottleId,
    })
    .from(catalogTargets)
    .where(eq(catalogTargets.groupId, groupId))
    .orderBy(asc(catalogTargets.id))
    .for("share");
  const genericTargets = targets.filter(({ bottleId }) => bottleId === null);
  const exactTargets = targets.filter(
    (target): target is typeof target & { bottleId: number } =>
      target.bottleId !== null,
  );
  const activeBottleIds = new Set(activeMembers.map(({ id }) => id));
  const exactTargetByBottleId = new Map(
    exactTargets.map((target) => [target.bottleId, target]),
  );
  if (
    genericTargets.length !== 1 ||
    exactTargets.length !== activeMembers.length ||
    exactTargets.some(({ bottleId }) => !activeBottleIds.has(bottleId)) ||
    activeMembers.some(({ id }) => !exactTargetByBottleId.has(id))
  ) {
    throw new BottleGroupStatsIntegrityError("invalid_catalog_graph", groupId);
  }

  const targetIds = [
    genericTargets[0]!.id,
    ...activeMembers.map(({ id }) => exactTargetByBottleId.get(id)!.id),
  ];
  const rawStatsResult = await tx.execute<RawRatingStats>(sql`
    SELECT
      COUNT(*) AS "totalTastings",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.PASS}) AS "pass",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SIP}) AS "sip",
      COUNT(*) FILTER (WHERE ${tastings.rating} = ${SIMPLE_RATING_VALUES.SAVOR}) AS "savor",
      COUNT(${tastings.rating}) AS "total",
      AVG(${tastings.rating}) AS "avg"
    FROM ${tastings}
    WHERE ${inArray(tastings.targetId, targetIds)}
  `);
  const rawStats = rawStatsResult.rows[0];
  if (!rawStats) {
    throw new BottleGroupStatsIntegrityError("invalid_catalog_graph", groupId);
  }

  const pass = countValue(rawStats.pass);
  const sip = countValue(rawStats.sip);
  const savor = countValue(rawStats.savor);
  const total = countValue(rawStats.total);
  const avg = averageValue(rawStats.avg);
  const ratingStats: BottleGroup["ratingStats"] = {
    pass,
    sip,
    savor,
    total,
    avg,
    percentage:
      total > 0
        ? {
            pass: (pass / total) * 100,
            sip: (sip / total) * 100,
            savor: (savor / total) * 100,
          }
        : { pass: 0, sip: 0, savor: 0 },
  };

  const [persisted] = await tx
    .update(bottleGroups)
    .set({
      totalBottles: activeMembers.length,
      totalTastings: countValue(rawStats.totalTastings),
      avgRating: avg,
      ratingStats,
      updatedAt: new Date(),
    })
    .where(eq(bottleGroups.id, groupId))
    .returning({
      id: bottleGroups.id,
      totalBottles: bottleGroups.totalBottles,
      totalTastings: bottleGroups.totalTastings,
      avgRating: bottleGroups.avgRating,
      ratingStats: bottleGroups.ratingStats,
      updatedAt: bottleGroups.updatedAt,
    });
  if (!persisted) {
    throw new BottleGroupStatsIntegrityError("invalid_catalog_graph", groupId);
  }
  return persisted;
}
