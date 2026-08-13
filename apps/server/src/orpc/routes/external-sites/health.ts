import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  storePrices,
  type ExternalSite,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteHealthSchema,
  ExternalSiteTypeEnum,
  listResponse,
} from "@peated/server/schemas";
import {
  serializeExternalSite,
  serializeExternalSiteRun,
} from "@peated/server/serializers/externalSite";
import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

async function getHealth(site: ExternalSite) {
  const [[listing], [latestRun], [lastSucceeded]] = await Promise.all([
    db
      .select({ value: count(storePrices.id) })
      .from(storePrices)
      .where(
        and(
          eq(storePrices.externalSiteId, site.id),
          eq(storePrices.hidden, false),
        ),
      ),
    db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.externalSiteId, site.id))
      .orderBy(desc(externalSiteRuns.createdAt))
      .limit(1),
    db
      .select({ completedAt: externalSiteRuns.completedAt })
      .from(externalSiteRuns)
      .where(
        and(
          eq(externalSiteRuns.externalSiteId, site.id),
          eq(externalSiteRuns.status, "succeeded"),
        ),
      )
      .orderBy(desc(externalSiteRuns.completedAt))
      .limit(1),
  ]);

  return {
    ...serializeExternalSite(site),
    listingCount: listing?.value ?? 0,
    latestRun: latestRun ? serializeExternalSiteRun(latestRun) : null,
    lastSucceededAt: lastSucceeded?.completedAt?.toISOString() ?? null,
  };
}

const inputSchema = z.object({
  query: z.coerce.string().default(""),
  sort: z.enum(["name", "-name"]).default("name"),
  cursor: z.coerce.number().gte(1).default(1),
  limit: z.coerce.number().gte(1).lte(100).default(100),
});

export const healthList = procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/external-sites",
    summary: "List external site health",
    operationId: "listExternalSiteHealth",
  })
  .input(inputSchema)
  .output(listResponse(ExternalSiteHealthSchema))
  .handler(async ({ input }) => {
    const offset = (input.cursor - 1) * input.limit;
    const results = await db
      .select()
      .from(externalSites)
      .where(
        input.query ? ilike(externalSites.name, `%${input.query}%`) : undefined,
      )
      .orderBy(
        input.sort === "-name"
          ? desc(externalSites.name)
          : asc(externalSites.name),
      )
      .limit(input.limit + 1)
      .offset(offset);

    return {
      results: await Promise.all(results.slice(0, input.limit).map(getHealth)),
      rel: {
        nextCursor: results.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });

export const healthDetails = procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/external-sites/{site}/health",
    summary: "Retrieve external site health",
    operationId: "retrieveExternalSiteHealth",
  })
  .input(z.object({ site: ExternalSiteTypeEnum }))
  .output(ExternalSiteHealthSchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });
    return getHealth(site);
  });
