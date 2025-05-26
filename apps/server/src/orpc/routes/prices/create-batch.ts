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
import { chunked } from "@peated/server/lib/scraper";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({ method: "POST", path: "/external-sites/{site}/prices" })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      prices: z.array(StorePriceInputSchema),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }

    // run batches in parallel as its a lot of i/o and sequential will be awful
    // particularly around image fetching
    await chunked(input.prices, 10, async (prices) => {
      return await Promise.all(
        prices.map(async (sp) => {
          const [price] = await db.transaction(async (tx) => {
            const { name } = normalizeBottle({ name: sp.name });
            const bottleId = await findBottleId(name);

            // XXX: maybe we should constrain on URL?
            const {
              rows: [{ id: priceId, imageUrl }],
            } = await db.execute<Pick<StorePrice, "id" | "imageUrl">>(sql`
              INSERT INTO ${storePrices} (bottle_id, external_site_id, name, volume, price, currency, url)
              VALUES (${bottleId}, ${site.id}, ${name}, ${sp.volume}, ${sp.price}, ${sp.currency}, ${sp.url})
              ON CONFLICT (external_site_id, LOWER(name), volume)
              DO UPDATE
              SET bottle_id = COALESCE(excluded.bottle_id, ${storePrices.bottleId}),
                  price = excluded.price,
                  currency = excluded.currency,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING id, image_url as imageUrl
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

            const ignored = !!name.match(
              / (bundle|gifting set|gift set|\d+ pack)$/i,
            );

            // TODO: sync image
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

            return [{ id: priceId, imageUrl }];
          });

          if (!price.imageUrl && sp.imageUrl) {
            await pushJob("CapturePriceImage", {
              priceId: price.id,
              imageUrl: sp.imageUrl,
            });
          }
        }),
      );
    });

    return {};
  });
