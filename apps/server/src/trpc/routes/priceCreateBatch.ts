import { db } from "@peated/server/db";
import type { StorePrice } from "@peated/server/db/schema";
import {
  bottleAliases,
  externalSites,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { findBottleId } from "@peated/server/lib/bottleFinder";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { normalizeBottle } from "@peated/server/lib/normalize";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
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
      const { name } = normalizeBottle({ name: sp.name });
      const bottleId = await findBottleId(name);
      await db.transaction(async (tx) => {
        // XXX: maybe we should constrain on URL?
        const {
          rows: [{ id: priceId }],
        } = await db.execute<Pick<StorePrice, "id">>(sql`
          INSERT INTO ${storePrices} (bottle_id, external_site_id, name, volume, price, currency, url)
          VALUES (${bottleId}, ${site.id}, ${name}, ${sp.volume}, ${sp.price}, ${sp.currency}, ${sp.url})
          ON CONFLICT (external_site_id, LOWER(name), volume)
          DO UPDATE
          SET bottle_id = COALESCE(excluded.bottle_id, ${storePrices.bottleId}),
              price = excluded.price,
              currency = excluded.currency,
              url = excluded.url,
              updated_at = NOW()
          RETURNING id
        `);

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

        const ignored = !!name.match(/ (bundle|gifting set)$/i);

        if (bottleId) {
          await upsertBottleAlias(tx, name, bottleId);
        } else {
          await tx
            .insert(bottleAliases)
            .values({
              name,
              ignored,
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
