import { db } from "@peated/server/db";
import { countries, entities, regions } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import userRegionListContract from "@peated/server/orpc/contracts/users/region-list";
import { inArray } from "drizzle-orm";
import {
  scanUserTastingBottles,
  UserBottleReadIntegrityError,
} from "./tasting-bottle-scan";

export default implement(userRegionListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const user = await getUserFromId(db, input.user, context.user);
  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found.",
    });
  }

  if (!(await profileVisible(db, user, context.user))) {
    throw errors.BAD_REQUEST({
      message: "User's profile is not public.",
    });
  }

  const geographyByBrand = new Map<
    number,
    { countryId: number | null; regionId: number | null } | null
  >();
  const grouped = new Map<
    string,
    { countryId: number; regionId: number | null; count: number }
  >();
  let totalCount = 0;

  try {
    for await (const rows of scanUserTastingBottles(user.id)) {
      totalCount += rows.length;
      const tastingCountsByBrand = new Map<number, number>();
      for (const { bottle } of rows) {
        if (!bottle) continue;
        const brandId = bottle.brandId;
        tastingCountsByBrand.set(
          brandId,
          (tastingCountsByBrand.get(brandId) ?? 0) + 1,
        );
      }

      const missingBrandIds = Array.from(tastingCountsByBrand.keys()).filter(
        (brandId) => !geographyByBrand.has(brandId),
      );
      if (missingBrandIds.length) {
        const brandRows = await db
          .select({
            id: entities.id,
            countryId: entities.countryId,
            regionId: entities.regionId,
          })
          .from(entities)
          .where(inArray(entities.id, missingBrandIds));

        for (const brandId of missingBrandIds) {
          geographyByBrand.set(brandId, null);
        }
        for (const { id, countryId, regionId } of brandRows) {
          geographyByBrand.set(id, { countryId, regionId });
        }
      }

      for (const [brandId, count] of tastingCountsByBrand) {
        const geography = geographyByBrand.get(brandId);
        if (!geography || geography.countryId === null) continue;
        const key = `${geography.countryId}:${geography.regionId ?? "null"}`;
        const current = grouped.get(key);
        if (current) {
          current.count += count;
        } else {
          grouped.set(key, {
            countryId: geography.countryId,
            regionId: geography.regionId,
            count,
          });
        }
      }
    }
  } catch (error) {
    if (error instanceof UserBottleReadIntegrityError) {
      throw errors.CONFLICT({ message: error.message, cause: error });
    }
    throw error;
  }

  // Country totals cover every group, not only the 25 returned in `results`,
  // so they match the tastings.list country filter.
  const countryCounts = new Map<number, number>();
  for (const { countryId, count } of grouped.values()) {
    countryCounts.set(countryId, (countryCounts.get(countryId) ?? 0) + count);
  }

  const aggregates = Array.from(grouped.values())
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.countryId - right.countryId ||
        (left.regionId === null
          ? 1
          : right.regionId === null
            ? -1
            : left.regionId - right.regionId),
    )
    .slice(0, 25);

  const countryIds = Array.from(countryCounts.keys());
  const countriesById = countryIds.length
    ? Object.fromEntries(
        (
          await db
            .select()
            .from(countries)
            .where(inArray(countries.id, countryIds))
        ).map((r) => [
          r.id,
          {
            name: r.name,
            slug: r.slug,
          },
        ]),
      )
    : {};

  const regionIds = Array.from(
    new Set(
      aggregates.flatMap(({ regionId }) =>
        regionId === null ? [] : [regionId],
      ),
    ),
  );
  const regionsById = regionIds.length
    ? Object.fromEntries(
        (
          await db.select().from(regions).where(inArray(regions.id, regionIds))
        ).map((r) => [
          r.id,
          {
            name: r.name,
            slug: r.slug,
          },
        ]),
      )
    : {};

  return {
    results: aggregates.map(({ countryId, regionId, count }) => ({
      country: countriesById[countryId],
      region: regionId === null ? null : regionsById[regionId],
      count,
    })),
    countries: Array.from(countryCounts, ([countryId, count]) => ({
      country: countriesById[countryId],
      count,
    })).sort(
      (left, right) =>
        right.count - left.count ||
        left.country.name.localeCompare(right.country.name),
    ),
    totalCount,
  };
});
