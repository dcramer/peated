import { db } from "@peated/server/db";
import {
  bottles,
  storePriceHistories,
  storePrices,
  stores,
} from "@peated/server/db/schema";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";

export async function findBottle(name: string): Promise<{ id: number } | null> {
  let bottle: { id: number } | null | undefined;

  // exact match
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, name))
    .limit(1);
  if (bottle) return bottle;

  // match the store's listing as a prefix
  // name: Aberfeldy 18-year-old Single Malt Scotch Whisky
  // bottle.fullName: Aberfeldy 18-year-old
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(sql`${name} ILIKE '%' || ${bottles.fullName} || '%'`)
    .orderBy(bottles.fullName)
    .limit(1);
  if (bottle) return bottle;

  // match our names are prefix as a last resort (this isnt often correct)
  // name: Aberfeldy 18-year-old
  // bottle.fullName: Aberfeldy 18-year-old Super Series
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, `${name} %`))
    .orderBy(bottles.fullName)
    .limit(1);

  return bottle;
}

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
      const bottle = await findBottle(sp.name);
      await db.transaction(async (tx) => {
        // XXX: maybe we should constrain on URL?
        const [{ priceId }] = await tx
          .insert(storePrices)
          .values({
            bottleId: bottle ? bottle.id : null,
            storeId: store.id,
            name: sp.name,
            price: sp.price,
            volume: sp.volume,
            url: sp.url,
          })
          .onConflictDoUpdate({
            target: [storePrices.storeId, storePrices.name, storePrices.volume],
            set: {
              bottleId: bottle ? bottle.id : null,
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
      });
    }

    await db
      .update(stores)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(stores.id, store.id));

    return {};
  });
