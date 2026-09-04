import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  countries,
  entities,
  regions,
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

export type BottleProductionLocations = {
  bottleId: number;
  countryIds: number[];
  regionIds: number[];
};

export type BottleCountLocation =
  | { kind: "country"; locationId: number }
  | { kind: "region"; locationId: number };

export type WrongLocationBottleCount = BottleCountLocation & {
  savedCount: number;
  actualCount: number;
};

function uniqueSorted(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

/** Returns each active Bottle's distinct producing Country and Region IDs. */
export async function getBottleProductionLocations(
  tx: AnyTransaction,
  bottleIds: readonly number[],
): Promise<BottleProductionLocations[]> {
  const ids = uniqueSorted(bottleIds);
  if (!ids.length) return [];

  const rows = await tx
    .select({
      bottleId: bottles.id,
      countryId: entities.countryId,
      regionId: entities.regionId,
    })
    .from(bottles)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.bottleId, bottles.id),
    )
    .innerJoin(entities, eq(entities.id, bottlesToDistillers.distillerId))
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(
      and(
        inArray(bottles.id, ids),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .orderBy(asc(bottles.id), asc(entities.countryId), asc(entities.regionId));

  const locations = new Map<
    number,
    { countryIds: Set<number>; regionIds: Set<number> }
  >();
  for (const row of rows) {
    const bottleLocations = locations.get(row.bottleId) ?? {
      countryIds: new Set<number>(),
      regionIds: new Set<number>(),
    };
    if (row.countryId !== null) bottleLocations.countryIds.add(row.countryId);
    if (row.regionId !== null) bottleLocations.regionIds.add(row.regionId);
    locations.set(row.bottleId, bottleLocations);
  }

  return Array.from(locations, ([bottleId, bottleLocations]) => ({
    bottleId,
    countryIds: uniqueSorted(Array.from(bottleLocations.countryIds)),
    regionIds: uniqueSorted(Array.from(bottleLocations.regionIds)),
  })).sort((left, right) => left.bottleId - right.bottleId);
}

function addLocationChanges(
  changes: Map<number, number>,
  locations: readonly BottleProductionLocations[],
  key: "countryIds" | "regionIds",
  change: number,
) {
  for (const bottleLocations of locations) {
    for (const locationId of bottleLocations[key]) {
      changes.set(locationId, (changes.get(locationId) ?? 0) + change);
    }
  }
}

type CountQueryRow = {
  kind: "country" | "region";
  locationId: number | string;
  savedCount: number | string;
  actualCount: number | string;
};

async function findWrongLocationBottleCounts(
  database: AnyDatabase,
  locations?: readonly BottleCountLocation[],
): Promise<WrongLocationBottleCount[]> {
  const countryIds =
    locations === undefined
      ? undefined
      : uniqueSorted(
          locations.flatMap((location) =>
            location.kind === "country" ? [location.locationId] : [],
          ),
        );
  const regionIds =
    locations === undefined
      ? undefined
      : uniqueSorted(
          locations.flatMap((location) =>
            location.kind === "region" ? [location.locationId] : [],
          ),
        );
  if (countryIds?.length === 0 && regionIds?.length === 0) return [];

  const countrySourceFilter =
    countryIds === undefined
      ? sql`TRUE`
      : countryIds.length
        ? inArray(entities.countryId, countryIds)
        : sql`FALSE`;
  const regionSourceFilter =
    regionIds === undefined
      ? sql`TRUE`
      : regionIds.length
        ? inArray(entities.regionId, regionIds)
        : sql`FALSE`;
  const countryFilter =
    countryIds === undefined
      ? sql`TRUE`
      : countryIds.length
        ? inArray(countries.id, countryIds)
        : sql`FALSE`;
  const regionFilter =
    regionIds === undefined
      ? sql`TRUE`
      : regionIds.length
        ? inArray(regions.id, regionIds)
        : sql`FALSE`;

  const result = await database.execute<CountQueryRow>(sql`
    WITH active_bottle_locations AS (
      SELECT
        ${bottles.id} AS bottle_id,
        'country'::text AS kind,
        ${entities.countryId} AS location_id
      FROM ${bottles}
      INNER JOIN ${bottlesToDistillers}
        ON ${bottlesToDistillers.bottleId} = ${bottles.id}
      INNER JOIN ${entities}
        ON ${entities.id} = ${bottlesToDistillers.distillerId}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${entities.countryId} IS NOT NULL
        AND ${countrySourceFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )

      UNION

      SELECT
        ${bottles.id} AS bottle_id,
        'region'::text AS kind,
        ${entities.regionId} AS location_id
      FROM ${bottles}
      INNER JOIN ${bottlesToDistillers}
        ON ${bottlesToDistillers.bottleId} = ${bottles.id}
      INNER JOIN ${entities}
        ON ${entities.id} = ${bottlesToDistillers.distillerId}
      WHERE ${bottles.groupId} IS NOT NULL
        AND ${entities.regionId} IS NOT NULL
        AND ${regionSourceFilter}
        AND NOT EXISTS (
          SELECT 1 FROM ${bottleTombstones}
          WHERE ${bottleTombstones.bottleId} = ${bottles.id}
        )
    ), actual_counts AS (
      SELECT kind, location_id, COUNT(*) AS total
      FROM active_bottle_locations
      GROUP BY kind, location_id
    ), saved_counts AS (
      SELECT
        'country'::text AS kind,
        ${countries.id} AS location_id,
        ${countries.totalBottles} AS saved_count
      FROM ${countries}
      WHERE ${countryFilter}

      UNION ALL

      SELECT
        'region'::text AS kind,
        ${regions.id} AS location_id,
        ${regions.totalBottles} AS saved_count
      FROM ${regions}
      WHERE ${regionFilter}
    )
    SELECT
      saved_counts.kind,
      saved_counts.location_id AS "locationId",
      saved_counts.saved_count AS "savedCount",
      COALESCE(actual_counts.total, 0) AS "actualCount"
    FROM saved_counts
    LEFT JOIN actual_counts
      ON actual_counts.kind = saved_counts.kind
      AND actual_counts.location_id = saved_counts.location_id
    WHERE saved_counts.saved_count <> COALESCE(actual_counts.total, 0)
    ORDER BY
      CASE saved_counts.kind WHEN 'country' THEN 0 ELSE 1 END,
      saved_counts.location_id
  `);

  return result.rows.map((row) => ({
    kind: row.kind,
    locationId: Number(row.locationId),
    savedCount: Number(row.savedCount),
    actualCount: Number(row.actualCount),
  }));
}

async function repairExistingLocationBottleCount(
  tx: AnyTransaction,
  location: BottleCountLocation,
): Promise<WrongLocationBottleCount | null> {
  const [difference] = await findWrongLocationBottleCounts(tx, [location]);
  if (!difference) return null;

  if (location.kind === "country") {
    await tx
      .update(countries)
      .set({ totalBottles: difference.actualCount })
      .where(eq(countries.id, location.locationId));
  } else {
    await tx
      .update(regions)
      .set({ totalBottles: difference.actualCount })
      .where(eq(regions.id, location.locationId));
  }
  return difference;
}

async function updateCountryBottleCount(
  tx: AnyTransaction,
  countryId: number,
  change: number,
) {
  const [updatedCountry] = await tx
    .update(countries)
    .set({ totalBottles: sql`${countries.totalBottles} + ${change}` })
    .where(
      and(
        eq(countries.id, countryId),
        change < 0 ? gte(countries.totalBottles, -change) : undefined,
      ),
    )
    .returning({ id: countries.id });
  if (updatedCountry) return;

  const [country] = await tx
    .select({ id: countries.id })
    .from(countries)
    .where(eq(countries.id, countryId))
    .for("update");
  if (!country) {
    throw new Error(
      `Cannot update Bottle count: Country ${countryId} is missing.`,
    );
  }
  await repairExistingLocationBottleCount(tx, {
    kind: "country",
    locationId: countryId,
  });
}

async function updateRegionBottleCount(
  tx: AnyTransaction,
  regionId: number,
  change: number,
) {
  const [updatedRegion] = await tx
    .update(regions)
    .set({ totalBottles: sql`${regions.totalBottles} + ${change}` })
    .where(
      and(
        eq(regions.id, regionId),
        change < 0 ? gte(regions.totalBottles, -change) : undefined,
      ),
    )
    .returning({ id: regions.id });
  if (updatedRegion) return;

  const [region] = await tx
    .select({ id: regions.id })
    .from(regions)
    .where(eq(regions.id, regionId))
    .for("update");
  if (!region) {
    throw new Error(
      `Cannot update Bottle count: Region ${regionId} is missing.`,
    );
  }
  await repairExistingLocationBottleCount(tx, {
    kind: "region",
    locationId: regionId,
  });
}

/** Saves production-location changes in the caller's catalog transaction. */
export async function updateLocationBottleCounts(
  tx: AnyTransaction,
  locationsBefore: readonly BottleProductionLocations[],
  locationsAfter: readonly BottleProductionLocations[],
): Promise<void> {
  const countryChanges = new Map<number, number>();
  const regionChanges = new Map<number, number>();
  addLocationChanges(countryChanges, locationsBefore, "countryIds", -1);
  addLocationChanges(countryChanges, locationsAfter, "countryIds", 1);
  addLocationChanges(regionChanges, locationsBefore, "regionIds", -1);
  addLocationChanges(regionChanges, locationsAfter, "regionIds", 1);

  // Bottle writes own these totals and always lock Countries before Regions,
  // in ID order. The helpers also repair an old undercount before it can fall
  // below zero.
  for (const [countryId, change] of Array.from(countryChanges)
    .filter(([, change]) => change !== 0)
    .sort(([left], [right]) => left - right)) {
    await updateCountryBottleCount(tx, countryId, change);
  }
  for (const [regionId, change] of Array.from(regionChanges)
    .filter(([, change]) => change !== 0)
    .sort(([left], [right]) => left - right)) {
    await updateRegionBottleCount(tx, regionId, change);
  }
}

/** Checks saved location Bottle totals against active Distillery links. */
export async function checkLocationBottleCounts(
  locations?: readonly BottleCountLocation[],
): Promise<WrongLocationBottleCount[]> {
  return findWrongLocationBottleCounts(db, locations);
}

/** Repairs one location after taking the row lock used by normal Bottle writes. */
export async function repairLocationBottleCount(
  location: BottleCountLocation,
): Promise<WrongLocationBottleCount | null> {
  return db.transaction(async (tx) => {
    const rows =
      location.kind === "country"
        ? await tx
            .select({ id: countries.id })
            .from(countries)
            .where(eq(countries.id, location.locationId))
            .for("update")
        : await tx
            .select({ id: regions.id })
            .from(regions)
            .where(eq(regions.id, location.locationId))
            .for("update");
    if (!rows.length) return null;

    return repairExistingLocationBottleCount(tx, location);
  });
}
