import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@peated/server/db";
import { storePrices, stores } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    z.object({
      store: z.number(),
      query: z.string().default(""),
      page: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(100),
    }),
  )
  .query(async function ({ input: { page, query, limit, ...input }, ctx }) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, input.store),
    });

    if (!store) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Store not found",
      });
    }

    const offset = (page - 1) * limit;

    const where: SQL[] = [
      eq(storePrices.storeId, store.id),
      sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
    ];
    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(storePrices)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(storePrices.name));

    return {
      results: await serialize(
        StorePriceSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  });
