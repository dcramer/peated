import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import type { StorePrice } from "@peated/server/db/schema";
import {
  externalSites,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { assignBottleAliasInTransaction } from "@peated/server/lib/bottleAliases";
import { findBottleTarget } from "@peated/server/lib/bottleFinder";
import { chunked } from "@peated/server/lib/scraper";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/external-sites/{site}/prices",
    summary: "Create batch prices",
    description:
      "Bulk create or update store prices for an external site with automatic bottle matching and alias creation. Requires admin privileges",
    operationId: "createPricesBatch",
  })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      prices: z.array(StorePriceInputSchema),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
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
            const aliasKey = normalizeBottleAliasKey(sp.name);
            // New assignments use the deterministic key, but lookup still
            // accepts legacy raw aliases created before alias keys existed.
            const target =
              (await findBottleTarget(aliasKey, tx)) ??
              (aliasKey !== sp.name
                ? await findBottleTarget(sp.name, tx)
                : null);
            const bottleId = target?.bottleId ?? null;
            const releaseId = target?.releaseId ?? null;

            // XXX: maybe we should constrain on URL?
            const {
              rows: [{ id: rawPriceId, imageUrl }],
            } = await tx.execute<Pick<StorePrice, "id" | "imageUrl">>(sql`
              INSERT INTO ${storePrices} (bottle_id, release_id, external_site_id, name, volume, price, currency, url)
              VALUES (${bottleId}, ${releaseId}, ${site.id}, ${name}, ${sp.volume}, ${sp.price}, ${sp.currency}, ${sp.url})
              ON CONFLICT (external_site_id, LOWER(name), volume)
              DO UPDATE
              SET bottle_id = COALESCE(excluded.bottle_id, ${storePrices.bottleId}),
                  release_id = COALESCE(excluded.release_id, ${storePrices.releaseId}),
                  price = excluded.price,
                  currency = excluded.currency,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING id, image_url as imageUrl
            `);
            const priceId = Number(rawPriceId);
            const actor = await getUserActorForDatabase(tx, context.user);

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
              await assignBottleAliasInTransaction(tx, {
                name: aliasKey,
                backfillNames: [name, sp.name],
                bottleId,
                releaseId,
                externalSiteId: site.id,
                volume: sp.volume,
                assignmentSource: "source_approved",
                assignedByActorId: actor.id,
              });
            }

            return [{ id: priceId, imageUrl, hasExactAliasTarget: !!target }];
          });

          if (!price.imageUrl && sp.imageUrl) {
            await pushJob("CapturePriceImage", {
              priceId: price.id,
              imageUrl: sp.imageUrl,
            });
          }

          if (!price.hasExactAliasTarget) {
            await pushUniqueJob("ResolveStorePriceBottle", {
              priceId: price.id,
            });
          }
        }),
      );
    });

    return {};
  });
