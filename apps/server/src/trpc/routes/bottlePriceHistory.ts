import { db } from "@peated/server/db";
import {
  bottles,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
    }),
  )
  .query(async function ({ input, ctx }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
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
