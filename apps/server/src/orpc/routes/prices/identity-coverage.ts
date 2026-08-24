import { db } from "@peated/server/db";
import { externalSites, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const SitePriceIdentityCoverageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    matched: z.number().int().nonnegative(),
    unmatched: z.number().int().nonnegative(),
    withSourceId: z.number().int().nonnegative(),
    withFingerprint: z.number().int().nonnegative(),
  })
  .strict();

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/external-sites/{site}/prices/identity-coverage",
    summary: "Get external-site price identity coverage",
    description:
      "Retrieve current StorePrice identity coverage for one external site. Requires admin privileges",
    operationId: "getExternalSitePriceIdentityCoverage",
  })
  .input(z.object({ site: ExternalSiteTypeEnum }).strict())
  .output(SitePriceIdentityCoverageSchema)
  .handler(async ({ input, errors }) => {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
      columns: { id: true },
    });
    if (!site) {
      throw errors.NOT_FOUND({ message: "Site not found." });
    }

    const [coverage] = await db
      .select({
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null)::int`,
        unmatched: sql<number>`count(*) filter (where ${storePrices.bottleId} is null)::int`,
        withSourceId: sql<number>`count(*) filter (where ${storePrices.externalProductId} is not null)::int`,
        withFingerprint: sql<number>`count(*) filter (where ${storePrices.sourceFingerprint} is not null)::int`,
      })
      .from(storePrices)
      .where(
        and(
          eq(storePrices.externalSiteId, site.id),
          eq(storePrices.hidden, false),
        ),
      );

    return coverage!;
  });
