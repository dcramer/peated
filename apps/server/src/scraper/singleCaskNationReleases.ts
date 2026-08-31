import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { db } from "@peated/server/db";
import { externalSites, storePrices } from "@peated/server/db/schema";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { and, eq, inArray } from "drizzle-orm";

type Release = {
  releaseYear: number;
  releaseMonth: number;
};

/** Returns saved release dates for Single Cask Nation products. */
export async function loadSingleCaskNationReleases(
  externalProductIds: string[],
): Promise<Map<string, Release>> {
  if (externalProductIds.length === 0) return new Map();

  const siteKey = "singlecasknation";
  const site = await db.query.externalSites.findFirst({
    columns: { id: true },
    where: eq(externalSites.type, siteKey),
  });
  if (!site) throw new ExternalSiteNotFoundError(siteKey);

  const rows = await db
    .select({
      externalProductId: storePrices.externalProductId,
      sourceBottleIdentity: storePrices.sourceBottleIdentity,
    })
    .from(storePrices)
    .where(
      and(
        eq(storePrices.externalSiteId, site.id),
        inArray(storePrices.externalProductId, externalProductIds),
      ),
    );

  const releases = new Map<string, Release>();
  for (const row of rows) {
    if (!row.externalProductId) continue;
    const identity = BottleExtractedDetailsSchema.safeParse(
      row.sourceBottleIdentity,
    );
    if (!identity.success) continue;

    const releaseYear = identity.data.release_year;
    const releaseMonth = identity.data.release_month;
    if (!releaseYear || !releaseMonth) continue;

    releases.set(row.externalProductId, {
      releaseYear,
      releaseMonth,
    });
  }
  return releases;
}
