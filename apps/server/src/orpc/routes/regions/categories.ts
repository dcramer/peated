import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { listBottleCategoriesByProductionLocation } from "@peated/server/lib/bottleProductionLocation";
import { procedure } from "@peated/server/orpc";
import { CategoryEnum } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/countries/{country}/regions/{region}/categories",
    summary: "Get region categories",
    description:
      "Retrieve whisky categories and their counts for a region based on distillery locations",
    operationId: "listRegionCategories",
  })
  .input(
    z.object({
      country: z.coerce.string(),
      region: z.coerce.string(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          count: z.number(),
          category: CategoryEnum.nullable(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, errors }) {
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
