import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottleSeries,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

export type BottleSeriesMembership = {
  bottleId: number;
  seriesId: number;
};

export type WrongBottleSeriesReleaseCount = {
  seriesId: number;
  savedCount: number;
  actualCount: number;
};

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

/** Returns active Bottles that belong to a BottleSeries. */
export async function getBottleSeriesMemberships(
  tx: AnyTransaction,
  bottleIds: readonly number[],
): Promise<BottleSeriesMembership[]> {
  const ids = uniqueSorted(bottleIds);
  if (!ids.length) return [];

  const rows = await tx
    .select({ bottleId: bottles.id, seriesId: bottles.seriesId })
    .from(bottles)
    .where(
      and(
        inArray(bottles.id, ids),
        isNotNull(bottles.seriesId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )`,
      ),
    )
    .orderBy(asc(bottles.id));

  return rows.flatMap(({ bottleId, seriesId }) =>
    seriesId === null ? [] : [{ bottleId, seriesId }],
  );
}

function addMembershipChanges(
  changes: Map<number, number>,
  memberships: readonly BottleSeriesMembership[],
  change: number,
) {
  for (const membership of memberships) {
    changes.set(
      membership.seriesId,
      (changes.get(membership.seriesId) ?? 0) + change,
    );
  }
}

type CountQueryRow = {
  seriesId: number | string;
  savedCount: number | string;
  actualCount: number | string;
};

async function findWrongBottleSeriesReleaseCounts(
  database: AnyDatabase,
  seriesIds?: readonly number[],
): Promise<WrongBottleSeriesReleaseCount[]> {
  const ids = seriesIds === undefined ? undefined : uniqueSorted(seriesIds);
  if (ids?.length === 0) return [];
  const seriesFilter = ids ? inArray(bottleSeries.id, ids) : sql`TRUE`;
  const bottleFilter = ids ? inArray(bottles.seriesId, ids) : sql`TRUE`;

  const result = await database.execute<CountQueryRow>(sql`
    WITH actual_counts AS (
      SELECT ${bottles.seriesId} AS series_id, COUNT(*) AS total
      FROM ${bottles}
      WHERE ${bottles.seriesId} IS NOT NULL
        AND ${bottleFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
      GROUP BY ${bottles.seriesId}
    )
    SELECT
      ${bottleSeries.id} AS "seriesId",
      ${bottleSeries.numReleases} AS "savedCount",
      COALESCE(actual_counts.total, 0) AS "actualCount"
    FROM ${bottleSeries}
    LEFT JOIN actual_counts ON actual_counts.series_id = ${bottleSeries.id}
    WHERE ${seriesFilter}
      AND ${bottleSeries.numReleases} <> COALESCE(actual_counts.total, 0)
    ORDER BY ${bottleSeries.id}
  `);

  return result.rows.map((row) => ({
    seriesId: Number(row.seriesId),
    savedCount: Number(row.savedCount),
    actualCount: Number(row.actualCount),
  }));
}

async function repairExistingBottleSeriesReleaseCount(
  tx: AnyTransaction,
  seriesId: number,
): Promise<WrongBottleSeriesReleaseCount | null> {
  const [difference] = await findWrongBottleSeriesReleaseCounts(tx, [seriesId]);
  if (!difference) return null;

  await tx
    .update(bottleSeries)
    .set({ numReleases: difference.actualCount })
    .where(eq(bottleSeries.id, seriesId));
  return difference;
}

/** Saves BottleSeries membership changes in the caller's Bottle transaction. */
export async function updateBottleSeriesReleaseCounts(
  tx: AnyTransaction,
  membershipsBefore: readonly BottleSeriesMembership[],
  membershipsAfter: readonly BottleSeriesMembership[],
): Promise<void> {
  const changes = new Map<number, number>();
  addMembershipChanges(changes, membershipsBefore, -1);
  addMembershipChanges(changes, membershipsAfter, 1);

  for (const [seriesId, change] of Array.from(changes)
    .filter(([, change]) => change !== 0)
    .sort(([left], [right]) => left - right)) {
    // Bottle writes own this total. Repair an old undercount before it can
    // make a valid Bottle deletion or merge fail.
    const [updatedSeries] = await tx
      .update(bottleSeries)
      .set({ numReleases: sql`${bottleSeries.numReleases} + ${change}` })
      .where(
        and(
          eq(bottleSeries.id, seriesId),
          change < 0 ? gte(bottleSeries.numReleases, -change) : undefined,
        ),
      )
      .returning({ id: bottleSeries.id });
    if (updatedSeries) continue;

    const [series] = await tx
      .select({ id: bottleSeries.id })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, seriesId))
      .limit(1)
      .for("update");
    if (!series) {
      throw new Error(
        `Cannot update release count: BottleSeries ${seriesId} is missing.`,
      );
    }

    await repairExistingBottleSeriesReleaseCount(tx, seriesId);
  }
}

/** Checks saved release totals against active Bottle membership. */
export async function checkBottleSeriesReleaseCounts(
  seriesIds?: readonly number[],
): Promise<WrongBottleSeriesReleaseCount[]> {
  return findWrongBottleSeriesReleaseCounts(db, seriesIds);
}

/** Repairs one BottleSeries after taking the row lock used by Bottle writes. */
export async function repairBottleSeriesReleaseCount(
  seriesId: number,
): Promise<WrongBottleSeriesReleaseCount | null> {
  return db.transaction(async (tx) => {
    const [series] = await tx
      .select({ id: bottleSeries.id })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, seriesId))
      .for("update");
    if (!series) return null;

    return repairExistingBottleSeriesReleaseCount(tx, seriesId);
  });
}
