import { db, type AnyTransaction } from "@peated/server/db";
import {
  bottleImages,
  bottleSeries,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

export type BottleSeriesRepresentativeRepair = {
  seriesId: number;
  savedBottleId: number | null;
  actualBottleId: number | null;
};

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

async function selectRepresentativeBottleId(
  tx: AnyTransaction,
  seriesId: number,
  currentBottleId: number | null,
): Promise<number | null> {
  const [candidate] = await tx
    .select({ id: bottles.id })
    .from(bottles)
    .innerJoin(
      bottleImages,
      and(
        eq(bottleImages.bottleId, bottles.id),
        eq(bottleImages.isPrimary, true),
      ),
    )
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(
      and(
        eq(bottles.seriesId, seriesId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${bottles.id} = ${currentBottleId} THEN 0 ELSE 1 END`,
      asc(bottles.id),
    )
    .limit(1);

  return candidate?.id ?? null;
}

/**
 * Keeps the Series image pointer on a stable active member with a primary
 * image. Bottle and image writers own this rule inside their transaction.
 */
export async function reconcileBottleSeriesRepresentatives(
  tx: AnyTransaction,
  seriesIds: readonly number[],
): Promise<BottleSeriesRepresentativeRepair[]> {
  const ids = uniqueSorted(seriesIds);
  if (!ids.length) return [];

  const seriesRows = await tx
    .select({
      id: bottleSeries.id,
      representativeBottleId: bottleSeries.representativeBottleId,
    })
    .from(bottleSeries)
    .where(inArray(bottleSeries.id, ids))
    .orderBy(asc(bottleSeries.id))
    .for("update");
  const repairs: BottleSeriesRepresentativeRepair[] = [];

  for (const series of seriesRows) {
    const actualBottleId = await selectRepresentativeBottleId(
      tx,
      series.id,
      series.representativeBottleId,
    );
    if (actualBottleId === series.representativeBottleId) continue;

    await tx
      .update(bottleSeries)
      .set({ representativeBottleId: actualBottleId })
      .where(eq(bottleSeries.id, series.id));
    repairs.push({
      seriesId: series.id,
      savedBottleId: series.representativeBottleId,
      actualBottleId,
    });
  }

  return repairs;
}

/** Reconciles the Series currently owning any of the supplied Bottles. */
export async function reconcileBottleSeriesRepresentativesForBottles(
  tx: AnyTransaction,
  bottleIds: readonly number[],
): Promise<BottleSeriesRepresentativeRepair[]> {
  const ids = uniqueSorted(bottleIds);
  if (!ids.length) return [];

  const rows = await tx
    .select({ seriesId: bottles.seriesId })
    .from(bottles)
    .where(and(inArray(bottles.id, ids), isNotNull(bottles.seriesId)));
  return reconcileBottleSeriesRepresentatives(
    tx,
    rows.flatMap(({ seriesId }) => (seriesId === null ? [] : [seriesId])),
  );
}

type RepresentativeQueryRow = {
  seriesId: number | string;
  savedBottleId: number | string | null;
  actualBottleId: number | string | null;
};

/** Finds Series whose saved image pointer is not the stable eligible choice. */
export async function checkBottleSeriesRepresentatives(
  seriesIds?: readonly number[],
): Promise<BottleSeriesRepresentativeRepair[]> {
  const ids = seriesIds === undefined ? undefined : uniqueSorted(seriesIds);
  if (ids?.length === 0) return [];
  const seriesFilter = ids ? inArray(bottleSeries.id, ids) : sql`TRUE`;
  const result = await db.execute<RepresentativeQueryRow>(sql`
    SELECT
      ${bottleSeries.id} AS "seriesId",
      ${bottleSeries.representativeBottleId} AS "savedBottleId",
      (
        SELECT ${bottles.id}
        FROM ${bottles}
        INNER JOIN ${bottleImages}
          ON ${bottleImages.bottleId} = ${bottles.id}
          AND ${bottleImages.isPrimary} = TRUE
        LEFT JOIN ${bottleTombstones}
          ON ${bottleTombstones.bottleId} = ${bottles.id}
        WHERE ${bottles.seriesId} = ${bottleSeries.id}
          AND ${bottles.groupId} IS NOT NULL
          AND ${bottleTombstones.bottleId} IS NULL
        ORDER BY
          CASE
            WHEN ${bottles.id} = ${bottleSeries.representativeBottleId}
              THEN 0
            ELSE 1
          END,
          ${bottles.id}
        LIMIT 1
      ) AS "actualBottleId"
    FROM ${bottleSeries}
    WHERE ${seriesFilter}
    ORDER BY ${bottleSeries.id}
  `);

  return result.rows.flatMap((row) => {
    const savedBottleId =
      row.savedBottleId === null ? null : Number(row.savedBottleId);
    const actualBottleId =
      row.actualBottleId === null ? null : Number(row.actualBottleId);
    return savedBottleId === actualBottleId
      ? []
      : [{ seriesId: Number(row.seriesId), savedBottleId, actualBottleId }];
  });
}

/** Repairs one Series after taking the same lock used by normal writers. */
export async function repairBottleSeriesRepresentative(
  seriesId: number,
): Promise<BottleSeriesRepresentativeRepair | null> {
  return db.transaction(async (tx) => {
    const repairs = await reconcileBottleSeriesRepresentatives(tx, [seriesId]);
    return repairs[0] ?? null;
  });
}
