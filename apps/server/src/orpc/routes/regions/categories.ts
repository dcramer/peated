import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { listBottleCategoriesByProductionLocation } from "@peated/server/lib/bottleProductionLocation";
import { implement } from "@peated/server/orpc";
import regionCategoriesContract from "@peated/server/orpc/contracts/regions/categories";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default implement(regionCategoriesContract).handler(async function ({
  input,
  errors,
}) {
  let countryId: number;
  if (Number.isFinite(+input.country)) {
    countryId = Number(input.country);
  } else {
    const [country] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()))
      .limit(1);
    if (!country) {
      throw errors.BAD_REQUEST({ message: "Invalid country." });
    }
    countryId = country.id;
  }

  const regionWhere = Number.isFinite(+input.region)
    ? eq(regions.id, Number(input.region))
    : eq(sql`LOWER(${regions.slug})`, input.region.toLowerCase());
  const [region] = await db
    .select({ id: regions.id })
    .from(regions)
    .where(and(eq(regions.countryId, countryId), regionWhere))
    .limit(1);
  if (!region) {
    throw errors.BAD_REQUEST({ message: "Invalid region." });
  }

  const results = await listBottleCategoriesByProductionLocation({
    regionId: region.id,
  });
  return {
    results,
    totalCount: results.reduce((total, { count }) => total + count, 0),
  };
});
