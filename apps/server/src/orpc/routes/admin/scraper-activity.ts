import { db } from "@peated/server/db";
import {
  actors,
  externalSiteRuns,
  externalSites,
  incomingBottleDecisionLogs,
  scrapeSourceRuns,
} from "@peated/server/db/schema";
import { PEATED_SYSTEM_ACTOR_KEY } from "@peated/server/lib/actors";
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
type SavedKind = "reviews" | "prices" | "bottles";
type DayCounts = HealthCounts & Record<SavedKind, number>;

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
      return "bottles";
    case "catalog":
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
      "Get daily scraper requests, runs, reviews, prices, bottles, and recent failures for the admin homepage.",
    operationId: "getScraperActivity",
  })
  .output(AdminScraperActivitySchema)
  .handler(async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const firstDay = new Date(today);
    firstDay.setUTCDate(firstDay.getUTCDate() - (DAYS - 1));

    const [rows, bottleDecisions] = await Promise.all([
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
          createdAt: incomingBottleDecisionLogs.createdAt,
          createdBottle: incomingBottleDecisionLogs.createdBottle,
        })
        .from(incomingBottleDecisionLogs)
        .innerJoin(actors, eq(actors.id, incomingBottleDecisionLogs.actorId))
        .where(
          and(
            gte(incomingBottleDecisionLogs.createdAt, firstDay),
            eq(actors.type, "system"),
            eq(actors.key, PEATED_SYSTEM_ACTOR_KEY),
            sql`NOT (${incomingBottleDecisionLogs.metadata} ? 'initiatedByUserId')`,
          ),
        ),
    ]);
    const collectionRows = rows.filter(
      ({ run, sourcePurpose }) => (sourcePurpose ?? run.purpose) === "collect",
    );

    const totals = emptyHealthCounts();
    const saved = {
      reviews: emptySavedCounts(),
      prices: emptySavedCounts(),
      bottles: emptySavedCounts(),
    };
    const days = new Map<string, DayCounts>();
    for (let offset = 0; offset < DAYS; offset += 1) {
      const date = new Date(firstDay);
      date.setUTCDate(date.getUTCDate() + offset);
      days.set(dayKey(date), {
        ...emptyHealthCounts(),
        reviews: 0,
        prices: 0,
        bottles: 0,
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

    for (const decision of bottleDecisions) {
      const day = days.get(dayKey(decision.createdAt));
      if (!day) continue;
      saved.bottles.total += 1;
      saved.bottles[decision.createdBottle ? "new" : "existing"] += 1;
      day.bottles += 1;
    }

    return {
      totals,
      saved,
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
