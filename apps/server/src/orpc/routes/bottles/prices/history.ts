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
  .route({
    method: "GET",
    path: "/bottles/{bottle}/price-history",
    summary: "Get bottle price history",
    description:
      "Retrieve one year of historical prices normalized by listed volume. Values use the currency's smallest unit per milliliter (for example, cents per mL)",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottlePriceHistory",
    }),
  })
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
          avgPrice: z
            .number()
            .describe(
              "Average price in the currency's smallest unit per milliliter",
            ),
          minPrice: z
            .number()
            .describe(
              "Minimum price in the currency's smallest unit per milliliter",
            ),
          maxPrice: z
            .number()
            .describe(
              "Maximum price in the currency's smallest unit per milliliter",
            ),
        }),
      ),
    }),
  )
  .handler(async function ({ input, errors }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const baseWhere = [
      eq(storePrices.bottleId, bottle.id),
      eq(storePrices.hidden, false),
      eq(storePriceHistories.currency, input.currency),
      sql`${storePriceHistories.date} >= CURRENT_DATE - interval '1 year'`,
    ];

    const results = await db
      .select({
        date: storePriceHistories.date,
        avgPrice: sql<string>`ROUND(AVG(${storePriceHistories.price}::numeric / NULLIF(${storePriceHistories.volume}, 0)))`,
        minPrice: sql<string>`ROUND(MIN(${storePriceHistories.price}::numeric / NULLIF(${storePriceHistories.volume}, 0)))`,
        maxPrice: sql<string>`ROUND(MAX(${storePriceHistories.price}::numeric / NULLIF(${storePriceHistories.volume}, 0)))`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(and(...baseWhere))
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
