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
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { findBottleAliasAssignment } from "@peated/server/lib/bottleFinder";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * Owns idempotent external-price persistence for user-authorized routes and
 * trusted workers. Both entries parse one contract before any write, and the
 * worker entry derives its actor instead of accepting authority from a job.
 */
export const CreateStorePricesInputSchema = z
  .object({
    site: ExternalSiteTypeEnum,
    prices: z.array(StorePriceInputSchema.strict()),
  })
  .strict();

export type CreateStorePricesInput = z.input<
  typeof CreateStorePricesInputSchema
>;

/** Persists one scraper batch with attribution chosen by the owning boundary. */
export async function createStorePrices(rawInput: unknown, actorId: number) {
  const input = CreateStorePricesInputSchema.parse(rawInput);
  const site = await db.query.externalSites.findFirst({
    where: eq(externalSites.type, input.site),
  });

  if (!site) {
    throw new ExternalSiteNotFoundError(input.site);
  }

  for (let at = 0; at < input.prices.length; at += 10) {
    const prices = input.prices.slice(at, at + 10);
    await Promise.all(
      prices.map(async (sp) => {
        const { price, aliasAssignment } = await db.transaction(async (tx) => {
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

          // A concurrent conflict may add identity first, so only fill an
          // unresolved row or reaffirm the same Bottle.
          const {
            rows: [
              { id: rawPriceId, imageUrl, bottleId: rawPersistedBottleId },
            ],
          } = await tx.execute<
            Pick<StorePrice, "id" | "imageUrl" | "bottleId">
          >(sql`
            INSERT INTO ${storePrices} (
              bottle_id,
              external_site_id,
              name,
              volume,
              price,
              currency,
              url,
              source_bottle_identity
            )
            VALUES (
              ${bottleId},
              ${site.id},
              ${name},
              ${sp.volume},
              ${sp.price},
              ${sp.currency},
              ${sp.url},
              ${JSON.stringify(sp.sourceBottleIdentity ?? null)}::jsonb
            )
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
                source_bottle_identity = COALESCE(
                  excluded.source_bottle_identity,
                  ${storePrices.sourceBottleIdentity}
                ),
                updated_at = NOW()
            RETURNING id, image_url AS "imageUrl", bottle_id AS "bottleId"
          `);
          const priceId = Number(rawPriceId);
          const persistedBottleId =
            rawPersistedBottleId === null ? null : Number(rawPersistedBottleId);
          const hasAliasMatch =
            bottleId !== null && persistedBottleId === bottleId;
          const aliasAssignment = hasAliasMatch
            ? await assignBottleAliasInTransaction(tx, {
                name: aliasKey,
                backfillNames: [name, sp.name],
                externalSiteId: site.id,
                volume: sp.volume,
                assignmentSource: "source_approved",
                assignedByActorId: actorId,
                bottleId,
                sourceAliasIdentity: match?.alias,
              })
            : null;

          await tx
            .insert(storePriceHistories)
            .values({
              priceId,
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
        });

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
  }
}

/** Trusted worker capability; callers cannot select an arbitrary actor. */
export async function createStorePricesAsPeated(input: unknown) {
  const actor = await getPeatedSystemActor();
  await createStorePrices(input, actor.id);
}
