import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { db, type AnyTransaction } from "@peated/server/db";
import { catalogListings, type CatalogListing } from "@peated/server/db/schema";
import {
  CatalogListingInputSchema,
  type CatalogListingInput,
  type ParsedCatalogListingInput,
} from "@peated/server/schemas";
import { and, eq, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

function catalogListingFingerprint(input: ParsedCatalogListingInput) {
  const facts = input.sourceBottleIdentity
    ? BottleExtractedDetailsSchema.parse(input.sourceBottleIdentity)
    : null;
  return createHash("sha256")
    .update(
      JSON.stringify([
        normalizeBottleReferenceKey(input.name),
        input.volume ?? null,
        facts,
      ]),
    )
    .digest("hex");
}

async function lockCatalogListingIdentity(
  tx: AnyTransaction,
  externalSiteId: number,
  input: ParsedCatalogListingInput,
) {
  const keys = [
    `catalog-listing-url:${externalSiteId}:${input.url}`,
    ...(input.externalProductId
      ? [`catalog-listing-product:${externalSiteId}:${input.externalProductId}`]
      : []),
  ].sort();
  for (const key of keys) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
  }
}

async function findCatalogListingForUpdate(
  tx: AnyTransaction,
  externalSiteId: number,
  input: ParsedCatalogListingInput,
) {
  const urlMatch = and(
    eq(catalogListings.externalSiteId, externalSiteId),
    eq(catalogListings.url, input.url),
  );
  const identityMatch = input.externalProductId
    ? or(
        urlMatch,
        and(
          eq(catalogListings.externalSiteId, externalSiteId),
          eq(catalogListings.externalProductId, input.externalProductId),
        ),
      )
    : urlMatch;
  const rows = await tx
    .select()
    .from(catalogListings)
    .where(identityMatch)
    .for("update");

  if (rows.length > 1) {
    throw new Error(
      `Catalog product identity conflicts for source ${externalSiteId} (${input.externalProductId ?? input.url}).`,
    );
  }
  const existing = rows[0] ?? null;
  if (
    existing?.externalProductId &&
    input.externalProductId &&
    existing.externalProductId !== input.externalProductId
  ) {
    throw new Error(
      `Catalog URL is already assigned to another source product (${externalSiteId}, ${input.url}).`,
    );
  }
  return existing;
}

/** Stores source evidence only. This function never resolves or mutates Bottles. */
export async function upsertCatalogListing(
  externalSiteId: number,
  rawInput: CatalogListingInput,
): Promise<CatalogListing> {
  const input = CatalogListingInputSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    await lockCatalogListingIdentity(tx, externalSiteId, input);
    const existing = await findCatalogListingForUpdate(
      tx,
      externalSiteId,
      input,
    );
    const values = {
      externalProductId:
        input.externalProductId ?? existing?.externalProductId ?? null,
      sourceFingerprint: catalogListingFingerprint(input),
      name: input.name,
      url: input.url,
      imageUrl: input.imageUrl ?? null,
      volume: input.volume ?? null,
      sourceBottleIdentity: input.sourceBottleIdentity ?? null,
      lastSeenAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    };

    if (!existing) {
      const [created] = await tx
        .insert(catalogListings)
        .values({ externalSiteId, ...values })
        .returning();
      if (!created) throw new Error("Catalog listing was not created.");
      return created;
    }

    const [updated] = await tx
      .update(catalogListings)
      .set(values)
      .where(eq(catalogListings.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error(`Catalog listing ${existing.id} was not updated.`);
    }
    return updated;
  });
}

export async function upsertCatalogListings(
  externalSiteId: number,
  listings: CatalogListingInput[],
) {
  const results: CatalogListing[] = [];
  for (const listing of listings) {
    results.push(await upsertCatalogListing(externalSiteId, listing));
  }
  return results;
}
