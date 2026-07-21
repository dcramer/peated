import { db } from "@peated/server/db";
import {
  bottles,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { recordStorePriceReadParity } from "@peated/server/orpc/routes/prices/read-parity";
import { CurrencyEnum } from "@peated/server/schemas";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import loadBottlePriceTargetId, {
  legacyStorePriceBottleMembership,
} from "./load-target";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/price-history",
    summary: "Get bottle price history",
    description:
      "Retrieve historical price data for a bottle including average, minimum, and maximum prices over time",
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

    const targetId = await loadBottlePriceTargetId(bottle.id);
    const targetWhere = eq(storePrices.targetId, targetId);
    const legacyWhere = legacyStorePriceBottleMembership(bottle.id);
    const baseWhere = [
      eq(storePrices.currency, input.currency),
      sql`${storePrices.updatedAt} > NOW() - interval '1 year'`,
    ];

    const results = await db
      .select({
        date: storePriceHistories.date,
        avgPrice: sql<string>`ROUND(AVG(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        minPrice: sql<string>`ROUND(MIN(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        maxPrice: sql<string>`ROUND(MAX(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(and(...baseWhere, targetWhere))
      .groupBy(storePriceHistories.date)
      .orderBy(desc(storePriceHistories.date));

    const parityCandidates = await db
      .selectDistinct({
        id: storePrices.id,
        targetId: storePrices.targetId,
        bottleId: storePrices.bottleId,
        releaseId: storePrices.releaseId,
        targetMatches: sql<boolean>`COALESCE(${targetWhere}, false)`,
        legacyMatches: sql<boolean>`COALESCE(${legacyWhere}, false)`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(and(...baseWhere, or(targetWhere, legacyWhere)));
    await recordStorePriceReadParity(
      parityCandidates,
      { caller: "bottles.prices.history", operation: "filter" },
      "catalog_reference",
    );

    return {
      results: results.map((r) => ({
        date: r.date,
        avgPrice: parseInt(r.avgPrice, 10),
        minPrice: parseInt(r.minPrice, 10),
        maxPrice: parseInt(r.maxPrice, 10),
      })),
    };
  });
