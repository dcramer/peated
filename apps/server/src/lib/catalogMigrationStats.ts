import type { AnyTransaction } from "@peated/server/db";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  type Bottle,
  type BottleGroup,
} from "@peated/server/db/schema";
import {
  aggregateBottleActivityStatsInTransaction,
  type BottleActivityStats,
} from "@peated/server/lib/recomputeBottleActivityStats";
import { asc, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

export type CatalogMigrationStatsFamily = Readonly<{
  groupId: number;
  retainedParentBottleId: number;
  promotedBottleIds: readonly number[];
}>;

export type CatalogMigrationStatsResult = Readonly<{
  bottlesRecomputed: number;
  groupsRecomputed: number;
}>;

export type CatalogMigrationStatsAssertionResult = Readonly<{
  bottlesValidated: number;
  groupsValidated: number;
}>;

export type CatalogMigrationStatsIntegrityErrorCode =
  | "invalid_input"
  | "invalid_catalog_graph"
  | "unexpected_tombstone"
  | "persistence_drift";

export class CatalogMigrationStatsIntegrityError extends Error {
  constructor(
    readonly code: CatalogMigrationStatsIntegrityErrorCode,
    readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(`Cannot recompute catalog migration statistics: ${code}.`);
    this.name = "CatalogMigrationStatsIntegrityError";
  }
}

type BottleStatsSnapshot = Pick<
  Bottle,
  "id" | "groupId" | "totalTastings" | "avgRating" | "ratingStats" | "updatedAt"
>;

type GroupStatsSnapshot = Pick<
  BottleGroup,
  | "id"
  | "totalBottles"
  | "totalTastings"
  | "avgRating"
  | "ratingStats"
  | "updatedAt"
>;

type ValidatedFamily = Readonly<{
  family: CatalogMigrationStatsFamily;
  groupUpdatedAt: Date;
  bottleUpdatedAt: ReadonlyMap<number, Date>;
}>;

function assertDatabaseId(
  value: number,
  field: string,
  familyIndex: number,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CatalogMigrationStatsIntegrityError("invalid_input", {
      familyIndex,
      field,
      value,
    });
  }
}

function validateFamilies(families: readonly CatalogMigrationStatsFamily[]) {
  const groupIds = new Set<number>();
  const bottleIds = new Set<number>();

  for (const [familyIndex, family] of families.entries()) {
    assertDatabaseId(family.groupId, "groupId", familyIndex);
    assertDatabaseId(
      family.retainedParentBottleId,
      "retainedParentBottleId",
      familyIndex,
    );
    if (groupIds.has(family.groupId)) {
      throw new CatalogMigrationStatsIntegrityError("invalid_input", {
        familyIndex,
        field: "groupId",
        value: family.groupId,
        reason: "duplicate",
      });
    }
    groupIds.add(family.groupId);

    for (const [role, bottleId] of [
      ["retainedParentBottleId", family.retainedParentBottleId] as const,
      ...family.promotedBottleIds.map(
        (promotedBottleId) => ["promotedBottleIds", promotedBottleId] as const,
      ),
    ]) {
      assertDatabaseId(bottleId, role, familyIndex);
      if (bottleIds.has(bottleId)) {
        throw new CatalogMigrationStatsIntegrityError("invalid_input", {
          familyIndex,
          field: role,
          value: bottleId,
          reason: "duplicate",
        });
      }
      bottleIds.add(bottleId);
    }
  }
}

function familyBottleIds(family: CatalogMigrationStatsFamily): number[] {
  return [family.retainedParentBottleId, ...family.promotedBottleIds].sort(
    (left, right) => left - right,
  );
}

async function assertFamilyGraph(
  tx: AnyTransaction,
  family: CatalogMigrationStatsFamily,
): Promise<ValidatedFamily> {
  const [group] = await tx
    .select({ id: bottleGroups.id, updatedAt: bottleGroups.updatedAt })
    .from(bottleGroups)
    .where(eq(bottleGroups.id, family.groupId))
    .limit(1)
    .for("update");
  if (!group) {
    throw new CatalogMigrationStatsIntegrityError("invalid_catalog_graph", {
      groupId: family.groupId,
      reason: "group_not_found",
    });
  }

  const [groupTombstone] = await tx
    .select({ groupId: bottleGroupTombstones.groupId })
    .from(bottleGroupTombstones)
    .where(eq(bottleGroupTombstones.groupId, family.groupId))
    .limit(1);
  if (groupTombstone) {
    throw new CatalogMigrationStatsIntegrityError("unexpected_tombstone", {
      groupId: family.groupId,
      objectType: "bottle_group",
    });
  }

  const members = await tx
    .select({ id: bottles.id, updatedAt: bottles.updatedAt })
    .from(bottles)
    .where(eq(bottles.groupId, family.groupId))
    .orderBy(asc(bottles.id))
    .for("share");
  const expectedBottleIds = familyBottleIds(family);
  const actualBottleIds = members.map(({ id }) => id);
  if (!isDeepStrictEqual(actualBottleIds, expectedBottleIds)) {
    throw new CatalogMigrationStatsIntegrityError("invalid_catalog_graph", {
      groupId: family.groupId,
      expectedBottleIds,
      actualBottleIds,
      reason: "membership_mismatch",
    });
  }

  for (const bottleId of actualBottleIds) {
    const [tombstone] = await tx
      .select({ bottleId: bottleTombstones.bottleId })
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, bottleId))
      .limit(1);
    if (tombstone) {
      throw new CatalogMigrationStatsIntegrityError("unexpected_tombstone", {
        groupId: family.groupId,
        bottleId,
        objectType: "bottle",
      });
    }
  }

  return {
    family,
    groupUpdatedAt: group.updatedAt,
    bottleUpdatedAt: new Map(
      members.map(({ id, updatedAt }) => [id, updatedAt]),
    ),
  };
}

async function validateGraph(
  tx: AnyTransaction,
  families: readonly CatalogMigrationStatsFamily[],
): Promise<ValidatedFamily[]> {
  validateFamilies(families);
  const validated: ValidatedFamily[] = [];
  for (const family of families) {
    validated.push(await assertFamilyGraph(tx, family));
  }
  return validated;
}

async function loadBottleStats(
  tx: AnyTransaction,
  bottleId: number,
): Promise<BottleStatsSnapshot | undefined> {
  const [persisted] = await tx
    .select({
      id: bottles.id,
      groupId: bottles.groupId,
      totalTastings: bottles.totalTastings,
      avgRating: bottles.avgRating,
      ratingStats: bottles.ratingStats,
      updatedAt: bottles.updatedAt,
    })
    .from(bottles)
    .where(eq(bottles.id, bottleId))
    .limit(1);
  return persisted;
}

async function loadGroupStats(
  tx: AnyTransaction,
  groupId: number,
): Promise<GroupStatsSnapshot | undefined> {
  const [persisted] = await tx
    .select({
      id: bottleGroups.id,
      totalBottles: bottleGroups.totalBottles,
      totalTastings: bottleGroups.totalTastings,
      avgRating: bottleGroups.avgRating,
      ratingStats: bottleGroups.ratingStats,
      updatedAt: bottleGroups.updatedAt,
    })
    .from(bottleGroups)
    .where(eq(bottleGroups.id, groupId))
    .limit(1);
  return persisted;
}

function expectedBottleStats(
  bottleId: number,
  groupId: number,
  updatedAt: Date,
  activity: BottleActivityStats,
): BottleStatsSnapshot {
  return { id: bottleId, groupId, updatedAt, ...activity };
}

function expectedGroupStats(
  groupId: number,
  totalBottles: number,
  updatedAt: Date,
  activity: BottleActivityStats,
): GroupStatsSnapshot {
  return { id: groupId, totalBottles, updatedAt, ...activity };
}

function combineActivityStats(
  activityByBottleId: ReadonlyMap<number, BottleActivityStats>,
  bottleIds: readonly number[],
): BottleActivityStats {
  let totalTastings = 0;
  let pass = 0;
  let sip = 0;
  let savor = 0;
  let total = 0;
  let ratingSum = 0;

  for (const bottleId of bottleIds) {
    const activity = activityByBottleId.get(bottleId);
    if (!activity) {
      throw new CatalogMigrationStatsIntegrityError("invalid_catalog_graph", {
        bottleId,
        reason: "activity_missing",
      });
    }
    totalTastings += activity.totalTastings;
    pass += activity.ratingStats.pass;
    sip += activity.ratingStats.sip;
    savor += activity.ratingStats.savor;
    total += activity.ratingStats.total;
    ratingSum +=
      activity.avgRating === null
        ? 0
        : activity.avgRating * activity.ratingStats.total;
  }

  const avg = total === 0 ? null : ratingSum / total;
  return {
    totalTastings,
    avgRating: avg,
    ratingStats: {
      pass,
      sip,
      savor,
      total,
      avg,
      percentage:
        total === 0
          ? { pass: 0, sip: 0, savor: 0 }
          : {
              pass: (pass / total) * 100,
              sip: (sip / total) * 100,
              savor: (savor / total) * 100,
            },
    },
  };
}

async function assertValidatedStats(
  tx: AnyTransaction,
  families: readonly ValidatedFamily[],
): Promise<CatalogMigrationStatsAssertionResult> {
  let bottlesValidated = 0;

  for (const { family, bottleUpdatedAt, groupUpdatedAt } of families) {
    const bottleIds = familyBottleIds(family);
    const activityByBottleId = new Map<number, BottleActivityStats>();
    for (const bottleId of bottleIds) {
      const updatedAt = bottleUpdatedAt.get(bottleId);
      if (!updatedAt) {
        throw new CatalogMigrationStatsIntegrityError("invalid_catalog_graph", {
          groupId: family.groupId,
          bottleId,
          reason: "validated_bottle_missing",
        });
      }
      const activity = await aggregateBottleActivityStatsInTransaction(tx, [
        bottleId,
      ]);
      activityByBottleId.set(bottleId, activity);
      const expected = expectedBottleStats(
        bottleId,
        family.groupId,
        updatedAt,
        activity,
      );
      const persisted = await loadBottleStats(tx, bottleId);
      if (!isDeepStrictEqual(persisted, expected)) {
        throw new CatalogMigrationStatsIntegrityError("persistence_drift", {
          objectType: "bottle",
          objectId: bottleId,
          expected,
          persisted,
        });
      }
      bottlesValidated += 1;
    }

    const activity = combineActivityStats(activityByBottleId, bottleIds);
    const expected = expectedGroupStats(
      family.groupId,
      bottleIds.length,
      groupUpdatedAt,
      activity,
    );
    const persisted = await loadGroupStats(tx, family.groupId);
    if (!isDeepStrictEqual(persisted, expected)) {
      throw new CatalogMigrationStatsIntegrityError("persistence_drift", {
        objectType: "bottle_group",
        objectId: family.groupId,
        expected,
        persisted,
      });
    }
  }

  return {
    bottlesValidated,
    groupsValidated: families.length,
  };
}

/**
 * Recomputes the migrated graph synchronously inside the caller's transaction.
 * Graph integrity is checked for every family before the first statistics write.
 * Migration timestamps are intentionally preserved as historical evidence.
 */
export async function recomputeCatalogMigrationStatsInTransaction(
  tx: AnyTransaction,
  families: readonly CatalogMigrationStatsFamily[],
): Promise<CatalogMigrationStatsResult> {
  const validated = await validateGraph(tx, families);
  let bottlesRecomputed = 0;
  const activityByBottleId = new Map<number, BottleActivityStats>();

  for (const { family, bottleUpdatedAt } of validated) {
    for (const bottleId of familyBottleIds(family)) {
      const activity = await aggregateBottleActivityStatsInTransaction(tx, [
        bottleId,
      ]);
      activityByBottleId.set(bottleId, activity);
      const updatedAt = bottleUpdatedAt.get(bottleId);
      if (!updatedAt) {
        throw new CatalogMigrationStatsIntegrityError("invalid_catalog_graph", {
          groupId: family.groupId,
          bottleId,
          reason: "validated_bottle_missing",
        });
      }
      const expected = expectedBottleStats(
        bottleId,
        family.groupId,
        updatedAt,
        activity,
      );
      const [persisted] = await tx
        .update(bottles)
        .set(activity)
        .where(eq(bottles.id, bottleId))
        .returning({
          id: bottles.id,
          groupId: bottles.groupId,
          totalTastings: bottles.totalTastings,
          avgRating: bottles.avgRating,
          ratingStats: bottles.ratingStats,
          updatedAt: bottles.updatedAt,
        });
      if (!isDeepStrictEqual(persisted, expected)) {
        throw new CatalogMigrationStatsIntegrityError("persistence_drift", {
          objectType: "bottle",
          objectId: bottleId,
          expected,
          persisted,
        });
      }
      bottlesRecomputed += 1;
    }
  }

  for (const { family, groupUpdatedAt } of validated) {
    const bottleIds = familyBottleIds(family);
    const activity = combineActivityStats(activityByBottleId, bottleIds);
    const expected = expectedGroupStats(
      family.groupId,
      bottleIds.length,
      groupUpdatedAt,
      activity,
    );
    const [persisted] = await tx
      .update(bottleGroups)
      .set({ totalBottles: bottleIds.length, ...activity })
      .where(eq(bottleGroups.id, family.groupId))
      .returning({
        id: bottleGroups.id,
        totalBottles: bottleGroups.totalBottles,
        totalTastings: bottleGroups.totalTastings,
        avgRating: bottleGroups.avgRating,
        ratingStats: bottleGroups.ratingStats,
        updatedAt: bottleGroups.updatedAt,
      });
    if (!isDeepStrictEqual(persisted, expected)) {
      throw new CatalogMigrationStatsIntegrityError("persistence_drift", {
        objectType: "bottle_group",
        objectId: family.groupId,
        expected,
        persisted,
      });
    }
  }

  return {
    bottlesRecomputed,
    groupsRecomputed: validated.length,
  };
}

/** Validates the migrated graph's aggregates without performing any writes. */
export async function assertCatalogMigrationStatsInTransaction(
  tx: AnyTransaction,
  families: readonly CatalogMigrationStatsFamily[],
): Promise<CatalogMigrationStatsAssertionResult> {
  return await assertValidatedStats(tx, await validateGraph(tx, families));
}
