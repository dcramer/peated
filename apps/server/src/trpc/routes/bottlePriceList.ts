import { db } from "@peated/server/db";
import { bottles, storePrices, stores } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithStoreSerializer } from "@peated/server/serializers/storePrice";
import { TRPCError } from "@trpc/server";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
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
        ...getTableColumns(storePrices),
        store: stores,
      })
      .from(storePrices)
      .innerJoin(stores, eq(storePrices.storeId, stores.id))
      .where(
        and(
          eq(storePrices.bottleId, bottle.id),
          sql`${storePrices.updatedAt} > NOW() - interval '1 week'`,
        ),
      );

    return {
      results: await serialize(
        StorePriceWithStoreSerializer,
        results,
        ctx.user,
      ),
    };
  });
