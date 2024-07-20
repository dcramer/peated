import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  countries,
  entities,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      country: z.union([z.string(), z.number()]),
    }),
  )
  .query(async function ({ input, ctx }) {
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
        throw new TRPCError({
          message: "Invalid country",
          code: "BAD_REQUEST",
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
      .select({ totalBottles: sql<number>`COUNT(*)` })
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
      totalCount: totalBottles,
    };
  });
