import { db } from "@peated/server/db";
import { catalogListings, externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  CatalogListingSchema,
  ExternalSiteKeySchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CatalogListingSerializer } from "@peated/server/serializers/catalogListing";
import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/external-sites/{site}/catalog-listings",
    summary: "List official catalog listings",
    description:
      "List products collected from one official catalog. Requires administrator privileges.",
    operationId: "listExternalSiteCatalogListings",
  })
  .input(
    z
      .object({
        site: ExternalSiteKeySchema,
        query: z.string().trim().max(200).default(""),
        cursor: z.coerce.number().int().gte(1).default(1),
        limit: z.coerce.number().int().gte(1).lte(100).default(50),
      })
      .strict(),
  )
  .output(listResponse(CatalogListingSchema))
  .handler(async ({ input, context, errors }) => {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
      columns: { id: true },
    });
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    const offset = (input.cursor - 1) * input.limit;
    const rows = await db
      .select()
      .from(catalogListings)
      .where(
        and(
          eq(catalogListings.externalSiteId, site.id),
          input.query
            ? ilike(catalogListings.name, `%${input.query}%`)
            : undefined,
        ),
      )
      .orderBy(asc(catalogListings.name), asc(catalogListings.id))
      .limit(input.limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        CatalogListingSerializer,
        rows.slice(0, input.limit),
        context.user,
      ),
      rel: {
        nextCursor: rows.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
