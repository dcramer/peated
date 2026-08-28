import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  configuredScraperConfigVersions,
  configuredScrapers,
  externalReviewArticles,
  externalReviewSourcePolicies,
  externalReviews,
  externalSiteRuns,
  externalSiteScrapeTargets,
  externalSites,
  scrapeOrigins,
  scrapeTargets,
  storePrices,
  type ExternalSite,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteHealthSchema,
  ExternalSiteKeySchema,
  listResponse,
  type ExternalSiteScrapeTargetSchema,
} from "@peated/server/schemas";
import { getScraperRegistration } from "@peated/server/scraper";
import {
  serializeExternalReviewSourcePolicy,
  serializeExternalSite,
  serializeExternalSiteRun,
} from "@peated/server/serializers/externalSite";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";

async function getHealthForSites(
  sites: ExternalSite[],
): Promise<z.infer<typeof ExternalSiteHealthSchema>[]> {
  if (sites.length === 0) return [];

  const siteIds = sites.map((site) => site.id);
  const [
    reviewCoverageRows,
    priceCoverageRows,
    latestRuns,
    lastSucceededRuns,
    runtimeRows,
    reviewPolicies,
    configuredRows,
  ] = await Promise.all([
    db
      .select({
        externalSiteId: externalReviewArticles.externalSiteId,
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${externalReviews.bottleId} is not null)::int`,
        unmatched: sql<number>`count(*) filter (where ${externalReviews.bottleId} is null)::int`,
      })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviews.articleId, externalReviewArticles.id),
      )
      // Admin health includes staged reviews so operators can verify imports
      // before publication.
      .where(inArray(externalReviewArticles.externalSiteId, siteIds))
      .groupBy(externalReviewArticles.externalSiteId),
    db
      .select({
        externalSiteId: storePrices.externalSiteId,
        total: sql<number>`count(*)::int`,
        matched: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null)::int`,
        unmatched: sql<number>`count(*) filter (where ${storePrices.bottleId} is null)::int`,
      })
      .from(storePrices)
      .where(
        and(
          inArray(storePrices.externalSiteId, siteIds),
          eq(storePrices.hidden, false),
        ),
      )
      .groupBy(storePrices.externalSiteId),
    db
      .selectDistinctOn([externalSiteRuns.externalSiteId])
      .from(externalSiteRuns)
      .where(inArray(externalSiteRuns.externalSiteId, siteIds))
      .orderBy(
        asc(externalSiteRuns.externalSiteId),
        desc(externalSiteRuns.createdAt),
      ),
    db
      .selectDistinctOn([externalSiteRuns.externalSiteId], {
        externalSiteId: externalSiteRuns.externalSiteId,
        completedAt: externalSiteRuns.completedAt,
      })
      .from(externalSiteRuns)
      .where(
        and(
          inArray(externalSiteRuns.externalSiteId, siteIds),
          eq(externalSiteRuns.status, "succeeded"),
        ),
      )
      .orderBy(
        asc(externalSiteRuns.externalSiteId),
        desc(externalSiteRuns.completedAt),
      ),
    db
      .select({
        externalSiteId: externalSiteScrapeTargets.externalSiteId,
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
          inArray(externalSiteScrapeTargets.externalSiteId, siteIds),
          eq(externalSiteScrapeTargets.active, true),
        ),
      )
      .orderBy(
        asc(externalSiteScrapeTargets.externalSiteId),
        asc(scrapeTargets.key),
        asc(scrapeOrigins.origin),
      ),
    db
      .select()
      .from(externalReviewSourcePolicies)
      .where(inArray(externalReviewSourcePolicies.externalSiteId, siteIds)),
    db
      .select({
        externalSiteId: configuredScrapers.externalSiteId,
        collection: configuredScrapers.collection,
        enabled: configuredScrapers.enabled,
        activeConfigVersionId: configuredScrapers.activeConfigVersionId,
        validationStatus: configuredScraperConfigVersions.validationStatus,
      })
      .from(configuredScrapers)
      .leftJoin(
        configuredScraperConfigVersions,
        eq(
          configuredScraperConfigVersions.id,
          configuredScrapers.activeConfigVersionId,
        ),
      )
      .where(inArray(configuredScrapers.externalSiteId, siteIds)),
  ]);

  const reviewCoverageBySite = new Map(
    reviewCoverageRows.map((row) => [row.externalSiteId, row]),
  );
  const priceCoverageBySite = new Map(
    priceCoverageRows.map((row) => [row.externalSiteId, row]),
  );
  const latestRunBySite = new Map(
    latestRuns.map((run) => [run.externalSiteId, run]),
  );
  const lastSucceededBySite = new Map(
    lastSucceededRuns.map((run) => [run.externalSiteId, run]),
  );
  const reviewPolicyBySite = new Map(
    reviewPolicies.map((policy) => [policy.externalSiteId, policy]),
  );
  const configuredBySite = new Map(
    configuredRows.map((row) => [row.externalSiteId, row]),
  );
  const targetsBySite = new Map<
    number,
    Map<string, z.infer<typeof ExternalSiteScrapeTargetSchema>>
  >();
  const now = Date.now();
  for (const row of runtimeRows) {
    let targets = targetsBySite.get(row.externalSiteId);
    if (!targets) {
      targets = new Map();
      targetsBySite.set(row.externalSiteId, targets);
    }
    let target = targets.get(row.targetKey);
    if (!target) {
      target = {
        key: row.targetKey,
        enabled: row.enabled,
        blockedUntil: row.blockedUntil?.toISOString() ?? null,
        coolingDown:
          row.blockedUntil !== null && row.blockedUntil.getTime() > now,
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

  return sites.map((site) => {
    const registration = getScraperRegistration(site.type);
    const configured = configuredBySite.get(site.id);
    const hasReviewPolicy =
      isExternalReviewSiteKey(site.type) ||
      configured?.collection === "reviews";
    const reviewCoverage = reviewCoverageBySite.get(site.id);
    const priceCoverage = priceCoverageBySite.get(site.id);
    const latestRun = latestRunBySite.get(site.id);
    const lastSucceeded = lastSucceededBySite.get(site.id);
    const targets = targetsBySite.get(site.id);
    const reviewPolicy = reviewPolicyBySite.get(site.id);

    return {
      ...serializeExternalSite(site),
      externalReviews: reviewCoverage ?? { total: 0, matched: 0, unmatched: 0 },
      priceListings: priceCoverage ?? { total: 0, matched: 0, unmatched: 0 },
      latestRun: latestRun ? serializeExternalSiteRun(latestRun) : null,
      lastSucceededAt: lastSucceeded?.completedAt?.toISOString() ?? null,
      runtime: {
        registered:
          registration !== null ||
          (configured?.enabled === true &&
            configured.activeConfigVersionId !== null &&
            configured.validationStatus === "passed"),
        targetKeys:
          registration?.targetKeys ??
          (configured ? [...(targets?.keys() ?? [])] : []),
        targets: targets ? [...targets.values()] : [],
      },
      reviewPolicy: hasReviewPolicy
        ? serializeExternalReviewSourcePolicy(site.id, reviewPolicy ?? null)
        : null,
    };
  });
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

    const sites = results.slice(0, input.limit);
    return {
      results: await getHealthForSites(sites),
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
  .input(z.object({ site: ExternalSiteKeySchema }))
  .output(ExternalSiteHealthSchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });
    const [health] = await getHealthForSites([site]);
    return health!;
  });
