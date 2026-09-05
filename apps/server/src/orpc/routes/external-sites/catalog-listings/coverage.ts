import { db } from "@peated/server/db";
import { catalogListings, externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  CatalogListingCoverageSchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/external-sites/{site}/catalog-listings/coverage",
    summary: "Count official catalog product details",
    description:
      "Count which collected products include a product ID, image, volume, or bottle details. Requires administrator privileges.",
    operationId: "getExternalSiteCatalogListingCoverage",
  })
  .input(z.object({ site: ExternalSiteKeySchema }).strict())
  .output(CatalogListingCoverageSchema)
  .handler(async ({ input, errors }) => {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
      columns: { id: true },
    });
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const [coverage] = await db
      .select({
        total: sql<number>`count(*)::int`,
        withProductId: sql<number>`count(*) filter (where ${catalogListings.externalProductId} is not null)::int`,
        withImage: sql<number>`count(*) filter (where ${catalogListings.imageUrl} is not null)::int`,
        withVolume: sql<number>`count(*) filter (where ${catalogListings.volume} is not null)::int`,
        withBottleDetails: sql<number>`count(*) filter (where ${catalogListings.sourceBottleIdentity} is not null)::int`,
      })
      .from(catalogListings)
      .where(eq(catalogListings.externalSiteId, site.id));
    return coverage!;
  });
