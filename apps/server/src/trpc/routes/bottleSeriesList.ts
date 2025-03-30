import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { type Context } from "../context";

const InputSchema = z.object({
  query: z.string().default(""),
  brand: z.number(),
  cursor: z.number().gte(1).default(1),
  limit: z.number().gte(1).lte(100).default(25),
});

async function bottleSeriesList({
  input: { query, brand, cursor, limit },
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const offset = (cursor - 1) * limit;

  const where: (SQL<unknown> | undefined)[] = [eq(bottleSeries.brandId, brand)];

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
    results: await serialize(BottleSeriesSerializer, results, ctx.user),
    total: total[0].count,
  };
}

export default publicProcedure.input(InputSchema).query(bottleSeriesList);
