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
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import type { IncomingMessage } from "http";
import { get } from "http";
import { z } from "zod";
import { adminProcedure } from "..";

function asyncGet(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      resolve(res);
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function fetchAndStoreImage(imageUrl: string): Promise<string | null> {
  const filename = imageUrl.split("/").pop() || "image";

  const file = await asyncGet(imageUrl);

  if (!file) return null;
  const fileData = {
    file,
    filename,
  };

  return await storeFile({
    data: fileData,
    namespace: `stores`,
    urlPrefix: "/uploads",
    onProcess: (...args) => compressAndResizeImage(...args, undefined, 1024),
  });
}

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

    // run batches in parallel as its a lot of i/o and sequential will be awful
    // particularly around image fetching
    await chunked(input.prices, 10, async (prices) => {
      return await Promise.all(
        prices.map(async (sp) => {
          return db.transaction(async (tx) => {
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

            if (!imageUrl && sp.imageUrl) {
              // TODO: we likely want to validate the image is something we'd expect
              await tx.update(storePrices).set({
                imageUrl: await fetchAndStoreImage(sp.imageUrl),
              });
            }

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
        }),
      );
    });
  });
