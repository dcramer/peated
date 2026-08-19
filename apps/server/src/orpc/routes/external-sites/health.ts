import { isExternalReviewSiteType } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSiteRuns,
  externalSiteScrapeTargets,
  externalSites,
  reviews,
  scrapeOrigins,
  scrapeTargets,
  storePrices,
  type ExternalSite,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteHealthSchema,
  ExternalSiteTypeEnum,
  listResponse,
  type ExternalSiteScrapeTargetSchema,
} from "@peated/server/schemas";
import { getScraperRegistration } from "@peated/server/scraper";
import {
  serializeExternalReviewSourcePolicy,
  serializeExternalSite,
  serializeExternalSiteRun,
} from "@peated/server/serializers/externalSite";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";

async function getHealth(site: ExternalSite) {
  const registration = getScraperRegistration(site.type);
  const hasReviewPolicy = isExternalReviewSiteType(site.type);
  const [
    [reviewCoverage],
    [priceCoverage],
    [latestRun],
    [lastSucceeded],
    runtimeRows,
    reviewPolicy,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${reviews.bottleId} is not null)::int`,
        unmatched: sql<number>`count(*) filter (where ${reviews.bottleId} is null)::int`,
      })
      .from(reviews)
      .where(
        and(eq(reviews.externalSiteId, site.id), eq(reviews.hidden, false)),
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null)::int`,
        unmatched: sql<number>`count(*) filter (where ${storePrices.bottleId} is null)::int`,
      })
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
    db
      .select({
        targetKey: scrapeTargets.key,
        enabled: scrapeTargets.enabled,
        blockedUntil: scrapeTargets.blockedUntil,
        minimumSpacingMs: scrapeTargets.minimumSpacingMs,
        requestsPerWindow: scrapeTargets.requestsPerWindow,
        windowMs: scrapeTargets.windowMs,
        origin: scrapeOrigins.origin,
        robotsMode: scrapeOrigins.robotsMode,
        robotsState: scrapeOrigins.robotsState,
        robotsFetchedAt: scrapeOrigins.robotsFetchedAt,
        robotsExpiresAt: scrapeOrigins.robotsExpiresAt,
      })
      .from(externalSiteScrapeTargets)
      .innerJoin(
        scrapeTargets,
        eq(externalSiteScrapeTargets.targetKey, scrapeTargets.key),
      )
      .leftJoin(
        scrapeOrigins,
        and(
          eq(scrapeOrigins.targetKey, scrapeTargets.key),
          eq(scrapeOrigins.active, true),
        ),
      )
      .where(
        and(
          eq(externalSiteScrapeTargets.externalSiteId, site.id),
          eq(externalSiteScrapeTargets.active, true),
        ),
      )
      .orderBy(asc(scrapeTargets.key), asc(scrapeOrigins.origin)),
    hasReviewPolicy
      ? db.query.externalReviewSourcePolicies.findFirst({
          where: eq(externalReviewSourcePolicies.externalSiteId, site.id),
        })
      : Promise.resolve(undefined),
  ]);

  const targets = new Map<
    string,
    z.infer<typeof ExternalSiteScrapeTargetSchema>
  >();
  for (const row of runtimeRows) {
    let target = targets.get(row.targetKey);
    if (!target) {
      target = {
        key: row.targetKey,
        enabled: row.enabled,
        blockedUntil: row.blockedUntil?.toISOString() ?? null,
        coolingDown:
          row.blockedUntil !== null && row.blockedUntil.getTime() > Date.now(),
        minimumSpacingMs: row.minimumSpacingMs,
        requestsPerWindow: row.requestsPerWindow,
        windowMs: row.windowMs,
        origins: [],
      };
      targets.set(row.targetKey, target);
    }
    if (row.origin && row.robotsMode) {
      target.origins.push({
        origin: row.origin,
        robotsMode: row.robotsMode,
        robotsStatus:
          row.robotsMode === "not_applicable"
            ? "not_applicable"
            : (row.robotsState?.status ?? "unknown"),
        robotsFetchedAt: row.robotsFetchedAt?.toISOString() ?? null,
        robotsExpiresAt: row.robotsExpiresAt?.toISOString() ?? null,
      });
    }
  }

  return {
    ...serializeExternalSite(site),
    reviews: reviewCoverage ?? { total: 0, matched: 0, unmatched: 0 },
    priceListings: priceCoverage ?? { total: 0, matched: 0, unmatched: 0 },
    latestRun: latestRun ? serializeExternalSiteRun(latestRun) : null,
    lastSucceededAt: lastSucceeded?.completedAt?.toISOString() ?? null,
    runtime: {
      registered: registration !== null,
      targetKeys: registration?.targetKeys ?? [],
      targets: [...targets.values()],
    },
    reviewPolicy: hasReviewPolicy
      ? serializeExternalReviewSourcePolicy(site.id, reviewPolicy ?? null)
      : null,
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
