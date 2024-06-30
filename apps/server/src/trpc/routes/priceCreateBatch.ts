import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalSites,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "..";

export default adminProcedure
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      prices: z.array(StorePriceInputSchema),
    }),
  )
  .mutation(async function ({ input }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw new TRPCError({
        message: "Site not found",
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
            externalSiteId: site.id,
            name: sp.name,
            price: sp.price,
            currency: sp.currency,
            volume: sp.volume,
            url: sp.url,
          })
          .onConflictDoUpdate({
            target: [
              storePrices.externalSiteId,
              storePrices.name,
              storePrices.volume,
            ],
            set: {
              bottleId,
              price: sp.price,
              currency: sp.currency,
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
            currency: sp.currency,
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
            .onConflictDoUpdate({
              target: [bottleAliases.name],
              set: {
                bottleId,
              },
              where: isNull(bottleAliases.bottleId),
            });
        } else {
          await db
            .insert(bottleAliases)
            .values({
              name: sp.name,
            })
            .onConflictDoNothing();
        }
      });
    }

    await db
      .update(externalSites)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(externalSites.id, site.id));

    return {};
  });
