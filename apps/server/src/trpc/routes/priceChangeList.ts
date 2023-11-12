import type { SQL } from "drizzle-orm";
import { and, eq, ilike, isNotNull, sql } from "drizzle-orm";

import { db } from "@peated/server/db";
import { storePriceHistories, storePrices } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottlePriceChangeSerializer } from "@peated/server/serializers/storePrice";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { query, cursor, limit, ...input }, ctx }) {
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
      })
      .from(storePrices)
      .innerJoin(
        storePriceHistories,
        eq(storePriceHistories.priceId, storePrices.id),
      )
      .where(and(...where))
      .groupBy(storePrices.bottleId)
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
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
