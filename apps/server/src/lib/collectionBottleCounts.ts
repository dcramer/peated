import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

export type WrongCollectionBottleCount = {
  collectionId: number;
  savedCount: number;
  actualCount: number;
};

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function addCountChanges(
  changes: Map<number, number>,
  collectionIds: readonly number[],
  change: number,
) {
  for (const collectionId of collectionIds) {
    changes.set(collectionId, (changes.get(collectionId) ?? 0) + change);
  }
}

type CountQueryRow = {
  collectionId: number | string;
  savedCount: number | string;
  actualCount: number | string;
};

async function findWrongCollectionBottleCounts(
  database: AnyDatabase,
  collectionIds?: readonly number[],
): Promise<WrongCollectionBottleCount[]> {
  const ids =
    collectionIds === undefined ? undefined : uniqueSorted(collectionIds);
  if (ids?.length === 0) return [];
  const collectionFilter = ids ? inArray(collections.id, ids) : sql`TRUE`;
  const membershipFilter = ids
    ? inArray(collectionBottles.collectionId, ids)
    : sql`TRUE`;

  const result = await database.execute<CountQueryRow>(sql`
    WITH actual_counts AS (
      SELECT ${collectionBottles.collectionId} AS collection_id, COUNT(*) AS total
      FROM ${collectionBottles}
      WHERE ${membershipFilter}
      GROUP BY ${collectionBottles.collectionId}
    )
    SELECT
      ${collections.id} AS "collectionId",
      ${collections.totalBottles} AS "savedCount",
      COALESCE(actual_counts.total, 0) AS "actualCount"
    FROM ${collections}
    LEFT JOIN actual_counts ON actual_counts.collection_id = ${collections.id}
    WHERE ${collectionFilter}
      AND ${collections.totalBottles} <> COALESCE(actual_counts.total, 0)
    ORDER BY ${collections.id}
  `);

  return result.rows.map((row) => ({
    collectionId: Number(row.collectionId),
    savedCount: Number(row.savedCount),
    actualCount: Number(row.actualCount),
  }));
}

async function repairExistingCollectionBottleCount(
  tx: AnyTransaction,
  collectionId: number,
): Promise<WrongCollectionBottleCount | null> {
  const [difference] = await findWrongCollectionBottleCounts(tx, [
    collectionId,
  ]);
  if (!difference) return null;

  await tx
    .update(collections)
    .set({ totalBottles: difference.actualCount })
    .where(eq(collections.id, collectionId));
  return difference;
}

/** Saves Collection membership changes in the caller's transaction. */
export async function updateCollectionBottleCounts(
  tx: AnyTransaction,
  collectionIdsBefore: readonly number[],
  collectionIdsAfter: readonly number[],
): Promise<void> {
  const changes = new Map<number, number>();
  addCountChanges(changes, collectionIdsBefore, -1);
  addCountChanges(changes, collectionIdsAfter, 1);

  for (const [collectionId, change] of Array.from(changes)
    .filter(([, change]) => change !== 0)
    .sort(([left], [right]) => left - right)) {
    // Membership writes own this count. Repair an old undercount before it can
    // make a valid removal or Bottle merge fail.
    const [updatedCollection] = await tx
      .update(collections)
      .set({ totalBottles: sql`${collections.totalBottles} + ${change}` })
      .where(
        and(
          eq(collections.id, collectionId),
          change < 0 ? gte(collections.totalBottles, -change) : undefined,
        ),
      )
      .returning({ id: collections.id });
    if (updatedCollection) continue;

    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1)
      .for("update");
    if (!collection) {
      throw new Error(
        `Cannot update Bottle count: Collection ${collectionId} is missing.`,
      );
    }

    await repairExistingCollectionBottleCount(tx, collectionId);
  }
}

/** Checks saved Bottle counts against Collection membership rows. */
export async function checkCollectionBottleCounts(
  collectionIds?: readonly number[],
): Promise<WrongCollectionBottleCount[]> {
  return findWrongCollectionBottleCounts(db, collectionIds);
}

/** Repairs one Collection after taking the row lock used by membership writes. */
export async function repairCollectionBottleCount(
  collectionId: number,
): Promise<WrongCollectionBottleCount | null> {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .for("update");
    if (!collection) return null;

    return repairExistingCollectionBottleCount(tx, collectionId);
  });
}
