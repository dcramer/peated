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
import {
  assignBottleAliasInTransaction,
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
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
          const { price, aliasAssignment } = await db.transaction(
            async (tx) => {
              const { name } = normalizeBottle({ name: sp.name });
              const aliasKey = normalizeBottleAliasKey(sp.name);
              // New assignments use the deterministic key, but lookup still
              // accepts legacy raw aliases created before alias keys existed.
              let match = await findBottleAliasAssignment(aliasKey, tx);
              if (!match && aliasKey !== sp.name) {
                match = await findBottleAliasAssignment(sp.name, tx);
              }
              const bottleId = match?.bottleId ?? null;
              if (bottleId !== null) {
                try {
                  await resolveActiveBottleIds(tx, [bottleId], {
                    lock: "update",
                  });
                } catch (error) {
                  if (!(error instanceof ActiveBottleSelectionError)) {
                    throw error;
                  }
                  switch (error.reason) {
                    case "missing":
                      throw new BottleAliasBottleNotFoundError(error.bottleId);
                    case "bottle_retired":
                      throw new BottleAliasBottleRetiredError(
                        error.bottleId,
                        error.replacementBottleId,
                      );
                    case "unassigned":
                      throw new BottleAliasBottleInactiveError(
                        error.bottleId,
                        error.reason,
                      );
                  }
                }
              }

              // XXX: maybe we should constrain on URL?
              // A concurrent conflict may add identity first, so only fill an
              // unresolved row or reaffirm the same Bottle.
              const {
                rows: [
                  { id: rawPriceId, imageUrl, bottleId: rawPersistedBottleId },
                ],
              } = await tx.execute<
                Pick<StorePrice, "id" | "imageUrl" | "bottleId">
              >(sql`
              INSERT INTO ${storePrices} (bottle_id, external_site_id, name, volume, price, currency, url)
              VALUES (${bottleId}, ${site.id}, ${name}, ${sp.volume}, ${sp.price}, ${sp.currency}, ${sp.url})
              ON CONFLICT (external_site_id, LOWER(name), volume)
              DO UPDATE
              SET bottle_id = CASE
                    WHEN excluded.bottle_id IS NOT NULL
                      AND (${storePrices.bottleId} IS NULL
                        OR ${storePrices.bottleId} = excluded.bottle_id)
                    THEN excluded.bottle_id
                    ELSE ${storePrices.bottleId}
                  END,
                  price = excluded.price,
                  currency = excluded.currency,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING id, image_url AS "imageUrl", bottle_id AS "bottleId"
            `);
              const priceId = Number(rawPriceId);
              const persistedBottleId =
                rawPersistedBottleId === null
                  ? null
                  : Number(rawPersistedBottleId);
              const hasAliasMatch =
                bottleId !== null && persistedBottleId === bottleId;
              const aliasAssignment = hasAliasMatch
                ? await assignBottleAliasInTransaction(tx, {
                    name: aliasKey,
                    backfillNames: [name, sp.name],
                    externalSiteId: site.id,
                    volume: sp.volume,
                    assignmentSource: "source_approved",
                    assignedByActorId: (
                      await getUserActorForDatabase(tx, context.user)
                    ).id,
                    bottleId,
                    sourceAliasIdentity: match?.alias,
                  })
                : null;

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

              return {
                price: {
                  id: priceId,
                  imageUrl,
                  hasAliasMatch,
                },
                aliasAssignment,
              };
            },
          );

          if (aliasAssignment) {
            await finalizeBottleAliasAssignment(aliasAssignment, {
              price: { id: price.id, site: input.site, name: sp.name },
            });
          }

          if (!price.imageUrl && sp.imageUrl) {
            await pushJob("CapturePriceImage", {
              priceId: price.id,
              imageUrl: sp.imageUrl,
            });
          }

          if (!price.hasAliasMatch) {
            await pushUniqueJob("ResolveStorePriceBottle", {
              priceId: price.id,
            });
          }
        }),
      );
    });

    return {};
  });
