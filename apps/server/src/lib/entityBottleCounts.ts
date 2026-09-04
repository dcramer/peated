import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";

type BottleLinks = {
  bottleId: number;
  entityIds: number[];
};

type WrongCount = {
  entityId: number;
  savedCount: number;
  actualCount: number;
};

type CountErrorCode = "missing_entity" | "negative_count";

export class EntityBottleCountError extends Error {
  constructor(
    readonly code: CountErrorCode,
    readonly entityId: number,
    readonly change: number,
  ) {
    const reason =
      code === "missing_entity"
        ? "the Entity does not exist"
        : "the Bottle count would be negative";
    super(
      `Cannot change the Bottle count for Entity ${entityId} by ${change}: ${reason}.`,
    );
    this.name = "EntityBottleCountError";
  }
}

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

/** Returns each active Bottle's unique Brand, Bottler, and Distillery IDs. */
export async function getBottleEntityLinks(
  tx: AnyTransaction,
  bottleIds: readonly number[],
): Promise<BottleLinks[]> {
  const ids = uniqueSorted(bottleIds);
  if (!ids.length) return [];

  const rows = await tx
    .select({
      bottleId: bottles.id,
      brandId: bottles.brandId,
      bottlerId: bottles.bottlerId,
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottles)
    .leftJoin(bottlesToDistillers, eq(bottlesToDistillers.bottleId, bottles.id))
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(
      and(
        inArray(bottles.id, ids),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .orderBy(asc(bottles.id), asc(bottlesToDistillers.distillerId));

  const links = new Map<number, Set<number>>();
  for (const row of rows) {
    const entityIds = links.get(row.bottleId) ?? new Set<number>();
    entityIds.add(row.brandId);
    if (row.bottlerId !== null) entityIds.add(row.bottlerId);
    if (row.distillerId !== null) entityIds.add(row.distillerId);
    links.set(row.bottleId, entityIds);
  }

  return Array.from(links, ([bottleId, entityIds]) => ({
    bottleId,
    entityIds: uniqueSorted(Array.from(entityIds)),
  })).sort((left, right) => left.bottleId - right.bottleId);
}

function addBottleCountChanges(
  countChanges: Map<number, number>,
  links: readonly BottleLinks[],
  change: number,
) {
  for (const { entityIds } of links) {
    for (const entityId of uniqueSorted(entityIds)) {
      countChanges.set(entityId, (countChanges.get(entityId) ?? 0) + change);
    }
  }
}

/** Saves the before-and-after link changes in the caller's Bottle transaction. */
export async function updateEntityBottleCounts(
  tx: AnyTransaction,
  linksBefore: readonly BottleLinks[],
  linksAfter: readonly BottleLinks[],
): Promise<void> {
  const countChanges = new Map<number, number>();
  addBottleCountChanges(countChanges, linksBefore, -1);
  addBottleCountChanges(countChanges, linksAfter, 1);

  for (const [entityId, change] of Array.from(countChanges)
    .filter(([, change]) => change !== 0)
    .sort(([left], [right]) => left - right)) {
    const [updatedEntity] = await tx
      .update(entities)
      .set({ totalBottles: sql`${entities.totalBottles} + ${change}` })
      .where(
        and(
          eq(entities.id, entityId),
          change < 0 ? gte(entities.totalBottles, -change) : undefined,
        ),
      )
      .returning({ id: entities.id });
    if (updatedEntity) continue;

    const existingEntity = await tx
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);
    throw new EntityBottleCountError(
      existingEntity.length ? "negative_count" : "missing_entity",
      entityId,
      change,
    );
  }
}

type CountQueryRow = {
  entityId: number | string;
  savedCount: number | string;
  actualCount: number | string;
};

async function findWrongCounts(
  database: AnyDatabase,
  entityIds?: readonly number[],
): Promise<WrongCount[]> {
  const ids = entityIds === undefined ? undefined : uniqueSorted(entityIds);
  if (ids?.length === 0) return [];
  const entityFilter = ids ? inArray(entities.id, ids) : sql`TRUE`;
  const brandFilter = ids ? inArray(bottles.brandId, ids) : sql`TRUE`;
  const bottlerFilter = ids ? inArray(bottles.bottlerId, ids) : sql`TRUE`;
  const distillerFilter = ids
    ? inArray(bottlesToDistillers.distillerId, ids)
    : sql`TRUE`;

  const result = await database.execute<CountQueryRow>(sql`
    WITH active_bottle_entities AS (
      SELECT ${bottles.id} AS bottle_id, ${bottles.brandId} AS entity_id
      FROM ${bottles}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${brandFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )

      UNION

      SELECT ${bottles.id} AS bottle_id, ${bottles.bottlerId} AS entity_id
      FROM ${bottles}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${bottles.bottlerId} IS NOT NULL
        AND ${bottlerFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )

      UNION

      SELECT ${bottles.id} AS bottle_id, ${bottlesToDistillers.distillerId} AS entity_id
      FROM ${bottlesToDistillers}
      INNER JOIN ${bottles}
        ON ${bottles.id} = ${bottlesToDistillers.bottleId}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${distillerFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
    ), actual_counts AS (
      SELECT entity_id, COUNT(*) AS total
      FROM active_bottle_entities
      GROUP BY entity_id
    )
    SELECT
      ${entities.id} AS "entityId",
      ${entities.totalBottles} AS "savedCount",
      COALESCE(actual_counts.total, 0) AS "actualCount"
    FROM ${entities}
    LEFT JOIN actual_counts ON actual_counts.entity_id = ${entities.id}
    WHERE ${entityFilter}
      AND ${entities.totalBottles} <> COALESCE(actual_counts.total, 0)
    ORDER BY ${entities.id}
  `);

  return result.rows.map((row) => ({
    entityId: Number(row.entityId),
    savedCount: Number(row.savedCount),
    actualCount: Number(row.actualCount),
  }));
}

/** Checks saved Bottle counts against the Bottle links in the database. */
export async function checkEntityBottleCounts(
  entityIds?: readonly number[],
): Promise<WrongCount[]> {
  return findWrongCounts(db, entityIds);
}

/** Repairs one Entity after taking the row lock used by normal Bottle writes. */
export async function repairEntityBottleCount(
  entityId: number,
): Promise<WrongCount | null> {
  return db.transaction(async (tx) => {
    const [entity] = await tx
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, entityId))
      .for("update");
    if (!entity) return null;

    const [difference] = await findWrongCounts(tx, [entityId]);
    if (!difference) return null;

    await tx
      .update(entities)
      .set({ totalBottles: difference.actualCount })
      .where(eq(entities.id, entityId));
    return difference;
  });
}

/** Repairs selected Entities one at a time so normal Bottle writes wait on one row. */
export async function repairEntityBottleCounts(
  entityIds: readonly number[],
): Promise<WrongCount[]> {
  const ids = uniqueSorted(entityIds);
  const repaired: WrongCount[] = [];
  for (const entityId of ids) {
    const difference = await repairEntityBottleCount(entityId);
    if (difference) repaired.push(difference);
  }
  return repaired;
}
