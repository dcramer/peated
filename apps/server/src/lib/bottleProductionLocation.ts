import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import {
  and,
  asc,
  isNotNull,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

type ProductionLocation =
  | { countryId: number | SQLWrapper; regionId?: never }
  | { countryId?: never; regionId: number | SQLWrapper };

// Bottle origin follows the producing distillery. Brand and bottler addresses
// describe business relationships and do not establish production location.
export function bottleProducedIn(location: ProductionLocation): SQL<unknown> {
  const locationWhere =
    location.countryId !== undefined
      ? sql`${entities.countryId} = ${location.countryId}`
      : sql`${entities.regionId} = ${location.regionId}`;

  return sql`EXISTS(
    SELECT FROM ${bottlesToDistillers}
    INNER JOIN ${entities}
      ON ${bottlesToDistillers.distillerId} = ${entities.id}
    WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
      AND ${locationWhere}
  )`;
}

export async function listBottleCategoriesByProductionLocation(
  location: ProductionLocation,
) {
  const rows = await db
    .select({
      category: bottles.category,
      count: sql<string>`COUNT(*)`,
    })
    .from(bottles)
    .where(
      and(
        isNotNull(bottles.groupId),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
        bottleProducedIn(location),
      ),
    )
    .groupBy(bottles.category)
    .orderBy(asc(bottles.category));

  return rows.map(({ count, category }) => ({
    count: Number(count),
    category,
  }));
}
