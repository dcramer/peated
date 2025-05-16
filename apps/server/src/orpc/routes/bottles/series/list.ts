import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleSeriesSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/bottle-series" })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      brand: z.coerce.number(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(BottleSeriesSchema),
      total: z.number(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { query, brand, cursor, limit } = input;
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleSeries.brandId, brand),
    ];

    if (query) {
      where.push(
        sql`${bottleSeries.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
      );
    }

    const [results, total] = await Promise.all([
      db
        .select()
        .from(bottleSeries)
        .where(where ? and(...where) : undefined)
        .orderBy(asc(bottleSeries.name))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bottleSeries)
        .where(where ? and(...where) : undefined),
    ]);

    return {
      results: await serialize(BottleSeriesSerializer, results, context.user),
      total: total[0].count,
    };
  });
