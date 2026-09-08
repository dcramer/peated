import { db } from "@peated/server/db";
import {
  externalReviews,
  externalSiteRuns,
  externalSites,
  incomingBottleDecisionLogs,
  scrapeSourceRuns,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import type {
  AdminScraperHealthCountsSchema,
  AdminScraperSavedCountsSchema,
} from "@peated/server/schemas";
import { AdminScraperActivitySchema } from "@peated/server/schemas";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";

const DAYS = 30;

type HealthCounts = z.infer<typeof AdminScraperHealthCountsSchema>;
type SavedCounts = z.infer<typeof AdminScraperSavedCountsSchema>;
type SavedKind = "reviews" | "prices" | "catalogListings";
type DayCounts = HealthCounts & Record<SavedKind, number>;

type BottleResolutionCounts = {
  unknown: number;
  created: number;
  matched: number;
};

function emptyHealthCounts(): HealthCounts {
  return {
    requests: 0,
    requestErrors: 0,
    requestErrorsComplete: true,
    runs: 0,
    failedRuns: 0,
  };
}

function emptySavedCounts(): SavedCounts {
  return { total: 0, new: 0, existing: 0 };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addRunHealth(
  counts: HealthCounts,
  run: typeof externalSiteRuns.$inferSelect,
) {
  counts.requests += run.requestCount;
  counts.requestErrors += run.requestErrorCount ?? 0;
  if (run.requestCount > 0 && run.requestErrorCount === null) {
    counts.requestErrorsComplete = false;
  }
  counts.runs += 1;
  counts.failedRuns += run.status === "failed" ? 1 : 0;
}

function addSavedRun(
  counts: SavedCounts,
  run: typeof externalSiteRuns.$inferSelect,
) {
  counts.total += run.emittedItemCount;
  counts.new += run.newItemCount;
  counts.existing += run.existingItemCount;
}

function savedKindForRun(
  recordType: typeof externalSiteRuns.$inferSelect.recordType,
): SavedKind | null {
  switch (recordType) {
    case "review":
      return "reviews";
    case "price":
      return "prices";
    case "bottle":
    case "catalog":
      return "catalogListings";
    case null:
      return null;
  }
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/scrapers/activity",
    summary: "Get scraper activity",
    description:
      "Get daily scraper requests, saved source records, Bottle resolution, and recent failures for the admin homepage.",
    operationId: "getScraperActivity",
  })
  .output(AdminScraperActivitySchema)
  .handler(async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const firstDay = new Date(today);
    firstDay.setUTCDate(firstDay.getUTCDate() - (DAYS - 1));

    const [rows, reviewResolutionRows, priceResolutionRows] = await Promise.all(
      [
        db
          .select({
            run: externalSiteRuns,
            site: externalSites,
            sourcePurpose: scrapeSourceRuns.purpose,
          })
          .from(externalSiteRuns)
          .innerJoin(
            externalSites,
            eq(externalSites.id, externalSiteRuns.externalSiteId),
          )
          .leftJoin(
            scrapeSourceRuns,
            eq(scrapeSourceRuns.externalSiteRunId, externalSiteRuns.id),
          )
          .where(gte(externalSiteRuns.createdAt, firstDay))
          .orderBy(desc(externalSiteRuns.createdAt)),
        db
          .select({
            unknown: sql<number>`count(*) filter (where ${externalReviews.bottleId} is null)::int`,
            created: sql<number>`count(*) filter (where ${externalReviews.bottleId} is not null and coalesce(${incomingBottleDecisionLogs.createdBottle}, false))::int`,
            matched: sql<number>`count(*) filter (where ${externalReviews.bottleId} is not null and not coalesce(${incomingBottleDecisionLogs.createdBottle}, false))::int`,
          })
          .from(externalReviews)
          .leftJoin(
            incomingBottleDecisionLogs,
            and(
              eq(incomingBottleDecisionLogs.sourceKind, "review"),
              eq(incomingBottleDecisionLogs.sourceId, externalReviews.id),
            ),
          )
          .where(
            and(
              gte(externalReviews.createdAt, firstDay),
              eq(externalReviews.hidden, false),
            ),
          ),
        db
          .select({
            unknown: sql<number>`count(*) filter (where ${storePrices.bottleId} is null)::int`,
            created: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null and coalesce(${incomingBottleDecisionLogs.createdBottle}, false))::int`,
            matched: sql<number>`count(*) filter (where ${storePrices.bottleId} is not null and not coalesce(${incomingBottleDecisionLogs.createdBottle}, false))::int`,
          })
          .from(storePrices)
          .leftJoin(
            incomingBottleDecisionLogs,
            and(
              eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
              eq(incomingBottleDecisionLogs.sourceId, storePrices.id),
            ),
          )
          .where(
            and(
              gte(storePrices.createdAt, firstDay),
              eq(storePrices.hidden, false),
            ),
          ),
      ],
    );
    const collectionRows = rows.filter(
      ({ run, sourcePurpose }) => (sourcePurpose ?? run.purpose) === "collect",
    );

    const totals = emptyHealthCounts();
    const saved = {
      reviews: emptySavedCounts(),
      prices: emptySavedCounts(),
      catalogListings: emptySavedCounts(),
    };
    const bottleResolution = [
      reviewResolutionRows[0],
      priceResolutionRows[0],
    ].reduce<BottleResolutionCounts>(
      (totals, counts) => ({
        unknown: totals.unknown + (counts?.unknown ?? 0),
        created: totals.created + (counts?.created ?? 0),
        matched: totals.matched + (counts?.matched ?? 0),
      }),
      { unknown: 0, created: 0, matched: 0 },
    );
    const days = new Map<string, DayCounts>();
    for (let offset = 0; offset < DAYS; offset += 1) {
      const date = new Date(firstDay);
      date.setUTCDate(date.getUTCDate() + offset);
      days.set(dayKey(date), {
        ...emptyHealthCounts(),
        reviews: 0,
        prices: 0,
        catalogListings: 0,
      });
    }

    for (const { run } of collectionRows) {
      const date = dayKey(run.startedAt ?? run.createdAt);
      const day = days.get(date);
      if (!day) continue;
      addRunHealth(totals, run);
      addRunHealth(day, run);
      const savedKind = savedKindForRun(run.recordType);
      if (savedKind) {
        addSavedRun(saved[savedKind], run);
        day[savedKind] += run.emittedItemCount;
      }
    }

    return {
      totals,
      saved,
      bottleResolution,
      days: [...days.entries()]
        .reverse()
        .map(([date, counts]) => ({ date, ...counts })),
      recentFailures: collectionRows
        .filter(
          ({ run }) => run.status === "failed" && run.completedAt !== null,
        )
        .slice(0, 5)
        .map(({ run, site }) => ({
          runId: run.id,
          site: { key: site.type, name: site.name },
          error: run.error ?? "No error details were saved.",
          completedAt: run.completedAt!.toISOString(),
        })),
    };
  });
