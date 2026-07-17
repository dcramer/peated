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
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import {
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  lockStagedTargetlessCatalogAssignmentInTransaction,
} from "@peated/server/lib/catalogTargets";
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

function assertNever(value: never): never {
  throw new TypeError(`Unhandled Bottle alias assignment: ${String(value)}`);
}

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
              let match = await findBottleAliasAssignment(
                aliasKey,
                {
                  caller: "prices.createBatch",
                  operation: "resolveNormalizedAlias",
                },
                tx,
              );
              if (!match && aliasKey !== sp.name) {
                match = await findBottleAliasAssignment(
                  sp.name,
                  {
                    caller: "prices.createBatch",
                    operation: "resolveLegacyRawAlias",
                  },
                  tx,
                );
              }
              const target = match?.kind === "target" ? match.target : null;
              const bottleId = match?.consumerIdentity.bottleId ?? null;
              const releaseId = match?.consumerIdentity.releaseId ?? null;
              const targetId = target?.targetId ?? null;

              // Target identity is serialized before any price, history, or
              // alias mutation. The assignment owner revalidates the alias
              // after consumers so merge/retarget work cannot commit stale use.
              if (match) {
                switch (match.kind) {
                  case "target":
                    await lockCatalogTargetAssignmentDescriptorsInTransaction(
                      tx,
                      [match.target],
                    );
                    break;
                  case "staged_targetless":
                    await lockStagedTargetlessCatalogAssignmentInTransaction(
                      tx,
                      match.stagedTargetless,
                    );
                    break;
                  default:
                    assertNever(match);
                }
              }

              // XXX: maybe we should constrain on URL?
              // The three CASE expressions deliberately share one authority
              // predicate so a conflict can never mix two identity decisions.
              const {
                rows: [{ id: rawPriceId, imageUrl }],
              } = await tx.execute<Pick<StorePrice, "id" | "imageUrl">>(sql`
              INSERT INTO ${storePrices} (target_id, bottle_id, release_id, external_site_id, name, volume, price, currency, url)
              VALUES (${targetId}, ${bottleId}, ${releaseId}, ${site.id}, ${name}, ${sp.volume}, ${sp.price}, ${sp.currency}, ${sp.url})
              ON CONFLICT (external_site_id, LOWER(name), volume)
              DO UPDATE
              SET target_id = CASE
                    WHEN excluded.target_id IS NOT NULL THEN excluded.target_id
                    WHEN excluded.bottle_id IS NOT NULL AND ${storePrices.targetId} IS NULL THEN NULL
                    ELSE ${storePrices.targetId}
                  END,
                  bottle_id = CASE
                    WHEN excluded.target_id IS NOT NULL THEN excluded.bottle_id
                    WHEN excluded.bottle_id IS NOT NULL AND ${storePrices.targetId} IS NULL THEN excluded.bottle_id
                    ELSE ${storePrices.bottleId}
                  END,
                  release_id = CASE
                    WHEN excluded.target_id IS NOT NULL THEN excluded.release_id
                    WHEN excluded.bottle_id IS NOT NULL AND ${storePrices.targetId} IS NULL THEN excluded.release_id
                    ELSE ${storePrices.releaseId}
                  END,
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

              const aliasAssignmentInput = {
                name: aliasKey,
                backfillNames: [name, sp.name],
                externalSiteId: site.id,
                volume: sp.volume,
                assignmentSource: "source_approved",
                assignedByActorId: actor.id,
              } satisfies Omit<
                Parameters<typeof assignBottleAliasInTransaction>[1],
                | "target"
                | "targetId"
                | "consumerIdentity"
                | "bottleId"
                | "releaseId"
                | "aliasReleaseId"
                | "context"
              >;
              const aliasAssignment =
                match?.kind === "target"
                  ? await assignBottleAliasInTransaction(tx, {
                      ...aliasAssignmentInput,
                      target: match.target,
                      consumerIdentity: match.consumerIdentity,
                      sourceAliasIdentity: match.alias,
                    })
                  : bottleId !== null
                    ? await assignBottleAliasInTransaction(tx, {
                        ...aliasAssignmentInput,
                        bottleId,
                        releaseId,
                        context: {
                          caller: "prices.createBatch",
                          operation: "assignStorePriceAlias",
                        },
                        sourceAliasIdentity: match?.alias,
                      })
                    : null;

              return {
                price: { id: priceId, imageUrl, hasAliasMatch: !!match },
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
