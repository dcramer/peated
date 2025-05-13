import type { SQL } from "drizzle-orm";
import { and, eq, ilike, isNotNull, sql } from "drizzle-orm";

import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { BottlePriceChangeSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottlePriceChangeSerializer } from "@peated/server/serializers/storePrice";
import { z } from "zod";
import { procedure } from "..";

const InputSchema = z
  .object({
    query: z.string().default(""),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(100),
  })
  .default({
    query: "",
    cursor: 1,
    limit: 100,
  });

const OutputSchema = z.object({
  results: z.array(BottlePriceChangeSchema),
  rel: z.object({
    nextCursor: z.number().nullable(),
    prevCursor: z.number().nullable(),
  }),
});

export default procedure
  .route({ method: "GET", path: "/price-changes" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input: { query, cursor, limit }, context }) {
    const offset = (cursor - 1) * limit;

    const minChange = 500; // $5

    const where: SQL[] = [
      isNotNull(storePrices.bottleId),
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
      sql`${storePriceHistories.date} < DATE(${storePrices.updatedAt})`,
      sql`${storePriceHistories.date} > NOW() - interval '4 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select({
        id: sql<number>`${storePrices.bottleId}`,
        price: sql<number>`AVG(${storePrices.price})`,
        previousPrice: sql<number>`AVG(${storePriceHistories.price})`,
        // force the type to fix nullable in default
        bottleId: sql<number>`${storePrices.bottleId}`,
        // assume this never changes
        currency: storePrices.currency,
      })
      .from(storePrices)
      .innerJoin(
        storePriceHistories,
        eq(storePriceHistories.priceId, storePrices.id),
      )
      .where(and(...where))
      .groupBy(storePrices.bottleId, storePrices.currency)
      .having(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) > ${minChange}`,
      )
      .orderBy(
        sql`ABS(AVG(${storePriceHistories.price}) - AVG(${storePrices.price})) DESC`,
      )
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        BottlePriceChangeSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
