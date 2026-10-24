import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  sql,
  type SQL,
} from "drizzle-orm";

// Counting rule: About charts count the same active Bottles as the Bottles
// tab (grouped, not tombstoned), so their numbers agree.
function activeBottle(): SQL<unknown> {
  return sql`${bottles.groupId} IS NOT NULL AND NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`;
}

function distilledAt(entityId: number): SQL<unknown> {
  return sql`EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.distillerId} = ${entityId} AND ${bottlesToDistillers.bottleId} = ${bottles.id})`;
}

async function countByYear(
  column: typeof bottles.vintageYear | typeof bottles.releaseYear,
  scope: SQL<unknown>,
) {
  const rows = await db
    .select({ year: column, count: count() })
    .from(bottles)
    .where(and(activeBottle(), scope))
    .groupBy(column)
    .orderBy(asc(column));
  return {
    results: rows.flatMap((row) =>
      row.year === null ? [] : [{ year: row.year, count: row.count }],
    ),
    withoutYear: rows.find((row) => row.year === null)?.count ?? 0,
  };
}

/** Bottles distilled at the Entity, by vintage year. */
export function countVintages(entityId: number) {
  return countByYear(bottles.vintageYear, distilledAt(entityId));
}

/** Bottles sold under the Entity as Brand, by release year. */
export function countReleaseYears(entityId: number) {
  return countByYear(bottles.releaseYear, eq(bottles.brandId, entityId));
}

/** Bottles distilled at the Entity, by bottler. */
export async function countBottlers(entityId: number) {
  const rows = await db
    .select({
      id: entities.id,
      name: entities.name,
      kind: entities.kind,
      count: count(),
    })
    .from(bottles)
    .leftJoin(entities, eq(entities.id, bottles.bottlerId))
    .where(and(activeBottle(), distilledAt(entityId)))
    .groupBy(entities.id, entities.name, entities.kind)
    .orderBy(desc(count()), asc(entities.name));
  return {
    results: rows.flatMap((row) =>
      row.id === null || row.name === null || row.kind === null
        ? []
        : [
            {
              entity: { id: row.id, name: row.name, kind: row.kind },
              count: row.count,
            },
          ],
    ),
    withoutEntity: rows.find((row) => row.id === null)?.count ?? 0,
  };
}

/** Bottles sold under the Entity as Brand, by distillery. */
export async function countDistillers(entityId: number) {
  const [rows, [withoutDistiller]] = await Promise.all([
    db
      .select({
        id: entities.id,
        name: entities.name,
        kind: entities.kind,
        count: count(),
      })
      .from(bottles)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.bottleId, bottles.id),
      )
      .innerJoin(entities, eq(entities.id, bottlesToDistillers.distillerId))
      .where(and(activeBottle(), eq(bottles.brandId, entityId)))
      .groupBy(entities.id, entities.name, entities.kind)
      .orderBy(desc(count()), asc(entities.name)),
    db
      .select({ count: count() })
      .from(bottles)
      .where(
        and(
          activeBottle(),
          eq(bottles.brandId, entityId),
          sql`NOT EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.bottleId} = ${bottles.id})`,
        ),
      ),
  ]);
  return {
    results: rows.map((row) => ({
      entity: { id: row.id, name: row.name, kind: row.kind },
      count: row.count,
    })),
    withoutEntity: withoutDistiller?.count ?? 0,
  };
}
