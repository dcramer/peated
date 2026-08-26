import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db, type AnyTransaction } from "@peated/server/db";
import {
  externalSites,
  storePriceHistories,
  storePrices,
  type StorePrice,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  BottleAliasBottleInactiveError,
  BottleAliasBottleNotFoundError,
  BottleAliasBottleRetiredError,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { normalizeGtin, type NormalizedGtin } from "@peated/server/lib/gtin";
import { ActiveBottleSelectionError } from "@peated/server/lib/resolveActiveBottleIds";
import { resolveStorePriceBottleMatchInTransaction } from "@peated/server/lib/storePriceBottleMatching";
import {
  ExternalSiteTypeEnum,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { pushJob, pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
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

type ParsedStorePrice = z.output<typeof StorePriceInputSchema>;

type StorePriceIdentity = {
  externalProductId?: string;
  externalSiteId: number;
  url: string;
};

function getSourceFingerprint({
  sourceVersion,
  normalizedName,
  volume,
  normalizedBarcode,
  sourceBottleIdentity,
}: {
  sourceVersion: string | null;
  normalizedName: string;
  volume: number;
  normalizedBarcode: string | null;
  sourceBottleIdentity: ParsedStorePrice["sourceBottleIdentity"] | null;
}) {
  // Price, image, and URL changes do not change Bottle identity. A source may
  // add its own version, but it cannot hide changes in the observed facts.
  const identityEvidence = sourceBottleIdentity
    ? [
        sourceBottleIdentity.brand,
        sourceBottleIdentity.bottler,
        sourceBottleIdentity.expression,
        sourceBottleIdentity.series,
        sourceBottleIdentity.distillery,
        sourceBottleIdentity.category,
        sourceBottleIdentity.stated_age,
        sourceBottleIdentity.abv,
        sourceBottleIdentity.release_year,
        sourceBottleIdentity.vintage_year,
        sourceBottleIdentity.cask_strength,
        sourceBottleIdentity.single_cask,
        sourceBottleIdentity.maturation,
        sourceBottleIdentity.cask_number,
        sourceBottleIdentity.outturn,
        sourceBottleIdentity.edition,
      ]
    : null;
  const evidence = JSON.stringify([
    sourceVersion,
    normalizeBottleAliasKey(normalizedName),
    volume,
    normalizedBarcode,
    identityEvidence,
  ]);
  return createHash("sha256").update(evidence).digest("hex");
}

function getStorePriceIdentityCondition({
  externalProductId,
  externalSiteId,
  url,
}: StorePriceIdentity) {
  const urlCondition = eq(storePrices.url, url);
  return externalProductId
    ? or(
        urlCondition,
        and(
          eq(storePrices.externalSiteId, externalSiteId),
          eq(storePrices.externalProductId, externalProductId),
        ),
      )!
    : urlCondition;
}

function selectStorePrice(
  rows: StorePrice[],
  input: StorePriceIdentity,
): StorePrice {
  if (rows.some((row) => row.externalSiteId !== input.externalSiteId)) {
    throw new Error(
      `Store URL is already assigned to another source (${input.externalSiteId}, ${input.url}).`,
    );
  }

  const productIds = new Set(
    rows.flatMap((row) =>
      row.externalProductId === null ? [] : [row.externalProductId],
    ),
  );
  if (
    productIds.size > 1 ||
    (input.externalProductId &&
      [...productIds].some((id) => id !== input.externalProductId))
  ) {
    throw new Error(
      `Store URL is already assigned to another source product (${input.externalSiteId}, ${input.url}).`,
    );
  }

  const bottleIds = new Set(
    rows.flatMap((row) => (row.bottleId === null ? [] : [row.bottleId])),
  );
  if (bottleIds.size > 1) {
    throw new Error(
      `Store product duplicates have conflicting Bottle assignments (${input.externalSiteId}, ${input.externalProductId ?? input.url}).`,
    );
  }

  return rows.toSorted((a, b) => {
    const productIdMatch =
      Number(b.externalProductId === input.externalProductId) -
      Number(a.externalProductId === input.externalProductId);
    if (productIdMatch) return productIdMatch;

    const visible = Number(!b.hidden) - Number(!a.hidden);
    if (visible) return visible;

    const bottleAssignment =
      Number(b.bottleId !== null) - Number(a.bottleId !== null);
    if (bottleAssignment) return bottleAssignment;

    const recency = b.updatedAt.getTime() - a.updatedAt.getTime();
    return recency || a.id - b.id;
  })[0];
}

async function findStorePriceForUpdate(
  tx: AnyTransaction,
  input: StorePriceIdentity,
) {
  const rows = await tx
    .select()
    .from(storePrices)
    .where(getStorePriceIdentityCondition(input))
    .for("update");
  if (rows.length === 0) return null;

  const existing = selectStorePrice(rows, input);
  const duplicateIds = rows
    .filter((row) => row.id !== existing.id)
    .map((row) => row.id);
  if (duplicateIds.length > 0) {
    // Exact source identity can converge legacy duplicate rows. Conflicting
    // source products and Bottle assignments fail in selectStorePrice.
    await tx
      .update(storePrices)
      .set({ hidden: true })
      .where(inArray(storePrices.id, duplicateIds));
  }
  return existing;
}

async function lockStorePriceIdentity(
  tx: AnyTransaction,
  { externalProductId, externalSiteId, url }: StorePriceIdentity,
) {
  const keys = [
    `store-price-url:${url}`,
    ...(externalProductId
      ? [`store-price-product:${externalSiteId}:${externalProductId}`]
      : []),
  ].sort();
  for (const key of keys) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
  }
}

async function persistStorePriceInTransaction({
  tx,
  externalSiteId,
  input,
  name,
  normalizedBarcode,
  bottleId,
}: {
  tx: AnyTransaction;
  externalSiteId: number;
  input: ParsedStorePrice;
  name: string;
  normalizedBarcode: NormalizedGtin | null;
  bottleId: number | null;
}) {
  const identity = {
    externalProductId: input.externalProductId,
    externalSiteId,
    url: input.url,
  };
  // Both source ids and fallback URLs are serialization boundaries. Ordering
  // the locks prevents two simultaneous URL/id changes from deadlocking.
  await lockStorePriceIdentity(tx, identity);
  let existing = await findStorePriceForUpdate(tx, identity);
  let sourceFingerprint = getSourceFingerprint({
    sourceVersion: input.sourceFingerprint ?? null,
    normalizedName: name,
    volume: input.volume,
    normalizedBarcode: normalizedBarcode?.gtin14 ?? null,
    sourceBottleIdentity: input.sourceBottleIdentity ?? null,
  });
  if (!existing) {
    const [created] = await tx
      .insert(storePrices)
      .values({
        bottleId,
        externalSiteId,
        externalProductId: input.externalProductId ?? null,
        sourceFingerprint,
        name,
        volume: input.volume,
        price: input.price,
        currency: input.currency,
        url: input.url,
        barcode: normalizedBarcode?.value ?? null,
        sourceBottleIdentity: input.sourceBottleIdentity ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return { price: created, sourceIdentityReused: false };

    existing = await findStorePriceForUpdate(tx, identity);
    if (!existing) {
      throw new Error(
        `Store product changed while its price was being saved (${externalSiteId}, ${input.externalProductId ?? input.url}).`,
      );
    }
  }

  if (
    existing.externalSiteId !== externalSiteId ||
    (input.externalProductId &&
      existing.externalProductId &&
      input.externalProductId !== existing.externalProductId)
  ) {
    throw new Error(
      `Store URL is already assigned to another source product (${externalSiteId}, ${input.url}).`,
    );
  }

  sourceFingerprint = getSourceFingerprint({
    sourceVersion: input.sourceFingerprint ?? null,
    normalizedName: name,
    volume: input.volume,
    normalizedBarcode:
      input.barcode === undefined
        ? (existing.barcode?.padStart(14, "0") ?? null)
        : (normalizedBarcode?.gtin14 ?? null),
    sourceBottleIdentity:
      input.sourceBottleIdentity ?? existing.sourceBottleIdentity,
  });

  const identityChanged =
    existing.sourceFingerprint !== null &&
    existing.sourceFingerprint !== sourceFingerprint;
  const sourceIdentityReused =
    !identityChanged && existing.bottleId !== null && bottleId === null;
  const persistedBottleId = identityChanged
    ? bottleId
    : bottleId !== null &&
        (existing.bottleId === null || existing.bottleId === bottleId)
      ? bottleId
      : existing.bottleId;
  const barcodeUpdate =
    input.barcode === undefined
      ? {}
      : {
          barcode: normalizedBarcode?.value ?? null,
        };
  const [updated] = await tx
    .update(storePrices)
    .set({
      bottleId: persistedBottleId,
      legacyReleaseId: identityChanged ? null : existing.legacyReleaseId,
      externalProductId: input.externalProductId ?? existing.externalProductId,
      sourceFingerprint,
      name,
      volume: input.volume,
      price: input.price,
      currency: input.currency,
      url: input.url,
      ...barcodeUpdate,
      sourceBottleIdentity:
        input.sourceBottleIdentity ?? existing.sourceBottleIdentity,
      updatedAt: sql`NOW()`,
    })
    .where(eq(storePrices.id, existing.id))
    .returning();
  if (!updated) {
    throw new Error(
      `Store price changed while it was being saved (${existing.id}).`,
    );
  }
  return { price: updated, sourceIdentityReused };
}

/** Persists one scraper batch with attribution chosen by the owning boundary. */
export async function createStorePrices(
  rawInput: CreateStorePricesInput,
  actorId: number,
) {
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
        const normalizedBarcode =
          sp.barcode === undefined || sp.barcode === null
            ? null
            : normalizeGtin(sp.barcode);
        const { price, aliasAssignment } = await db.transaction(async (tx) => {
          const { name } = normalizeBottle({ name: sp.name });
          const aliasKey = normalizeBottleAliasKey(sp.name);
          let bottleMatch;
          try {
            bottleMatch = await resolveStorePriceBottleMatchInTransaction(tx, {
              name: sp.name,
              normalizedBarcode,
              sourceBottleIdentity: sp.sourceBottleIdentity ?? null,
              volume: sp.volume,
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
          const { aliasMatch: match, bottleId } = bottleMatch;

          const persisted = await persistStorePriceInTransaction({
            tx,
            externalSiteId: site.id,
            input: sp,
            name,
            normalizedBarcode,
            bottleId,
          });
          const priceId = persisted.price.id;
          const persistedBottleId = persisted.price.bottleId;
          const hasDirectMatch =
            persisted.sourceIdentityReused ||
            (bottleId !== null && persistedBottleId === bottleId);
          const hasAliasMatch =
            !persisted.sourceIdentityReused &&
            hasDirectMatch &&
            bottleMatch.source === "alias";
          const aliasAssignment =
            bottleId !== null && hasAliasMatch
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
              imageUrl: persisted.price.imageUrl,
              hasDirectMatch,
              directMatchSource: persisted.sourceIdentityReused
                ? "source"
                : hasDirectMatch
                  ? bottleMatch.source
                  : null,
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

        if (price.directMatchSource === "barcode") {
          await pushUniqueJob("ResolveStorePriceBottle", {
            priceId: price.id,
            force: true,
          });
        } else if (!price.hasDirectMatch) {
          await pushUniqueJob("ResolveStorePriceBottle", {
            priceId: price.id,
          });
        }
      }),
    );
  }
}

/** Trusted worker capability; callers cannot select an arbitrary actor. */
export async function createStorePricesAsPeated(input: CreateStorePricesInput) {
  const actor = await getPeatedSystemActor();
  await createStorePrices(input, actor.id);
}
