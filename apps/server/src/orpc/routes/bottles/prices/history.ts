import { db } from "@peated/server/db";
import {
  bottles,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CurrencyEnum } from "@peated/server/schemas";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/bottles/{bottle}/price-history" })
  .input(
    z.object({
      bottle: z.coerce.number(),
      currency: CurrencyEnum.default("usd"),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          date: z.string(),
          avgPrice: z.number(),
          minPrice: z.number(),
          maxPrice: z.number(),
        }),
      ),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const results = await db
      .select({
        date: storePriceHistories.date,
        avgPrice: sql<string>`ROUND(AVG(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        minPrice: sql<string>`ROUND(MIN(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        maxPrice: sql<string>`ROUND(MAX(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(
        and(
          eq(storePrices.currency, input.currency),
          eq(storePrices.bottleId, bottle.id),
          sql`${storePrices.updatedAt} > NOW() - interval '1 year'`,
        ),
      )
      .groupBy(storePriceHistories.date)
      .orderBy(desc(storePriceHistories.date));

    return {
      results: results.map((r) => ({
        date: r.date,
        avgPrice: parseInt(r.avgPrice, 10),
        minPrice: parseInt(r.minPrice, 10),
        maxPrice: parseInt(r.maxPrice, 10),
      })),
    };
  });
