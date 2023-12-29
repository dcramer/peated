import { db } from "@peated/server/db";
import {
  bottleAliases,
  storePriceHistories,
  storePrices,
  stores,
} from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    z.object({
      store: z.number(),
      prices: z.array(StorePriceInputSchema),
    }),
  )
  .mutation(async function ({ input }) {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, input.store),
    });

    if (!store) {
      throw new TRPCError({
        message: "Store not found",
        code: "NOT_FOUND",
      });
    }

    for (const sp of input.prices) {
      const bottleId = await findBottleId(sp.name);
      await db.transaction(async (tx) => {
        // XXX: maybe we should constrain on URL?
        const [{ priceId }] = await tx
          .insert(storePrices)
          .values({
            bottleId,
            storeId: store.id,
            name: sp.name,
            price: sp.price,
            volume: sp.volume,
            url: sp.url,
          })
          .onConflictDoUpdate({
            target: [storePrices.storeId, storePrices.name, storePrices.volume],
            set: {
              bottleId,
              price: sp.price,
              url: sp.url,
              volume: sp.volume,
              updatedAt: sql`NOW()`,
            },
          })
          .returning({ priceId: storePrices.id });

        await tx
          .insert(storePriceHistories)
          .values({
            priceId: priceId,
            price: sp.price,
            volume: sp.volume,
            date: sql`CURRENT_DATE`,
          })
          .onConflictDoNothing();

        if (bottleId) {
          await tx
            .insert(bottleAliases)
            .values({
              bottleId,
              name: sp.name,
            })
            .onConflictDoNothing();
        }
      });
    }

    await db
      .update(stores)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(stores.id, store.id));

    return {};
  });
