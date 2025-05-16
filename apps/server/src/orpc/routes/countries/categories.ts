import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/countries/categories" })
  .input(
    z.object({
      country: z.union([z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          count: z.number(),
          category: z.string().nullable(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, errors }) {
    let countryId: number;

    if (typeof input.country === "number") {
      countryId = input.country;
    } else {
      const [result] = await db
        .select({ id: countries.id })
        .from(countries)
        .where(eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()))
        .limit(1);
      if (!result) {
        throw errors.BAD_REQUEST({
          message: "Invalid country.",
        });
      }
      countryId = result.id;
    }

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const results = (
      await db.execute<{
        count: string;
        category: string | null;
      }>(
        sql`SELECT COUNT(*) as count, category
              FROM ${bottles}
              WHERE EXISTS(
                  SELECT FROM ${bottlesToDistillers}
                  JOIN ${entities}
                    ON ${bottlesToDistillers.distillerId} = ${entities.id}
                  WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                    AND ${entities.countryId} = ${countryId}
                 )
              GROUP BY ${bottles.category}`,
      )
    ).rows;

    const [{ totalBottles }] = await db
      .select({ totalBottles: sql<string>`COUNT(*)` })
      .from(bottles)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.bottleId, bottles.id),
      )
      .innerJoin(entities, eq(bottlesToDistillers.distillerId, entities.id))
      .where(and(eq(entities.countryId, countryId)));

    return {
      results: results.map(({ count, category }) => ({
        count: Number(count),
        category,
      })),
      totalCount: Number(totalBottles),
    };
  });
