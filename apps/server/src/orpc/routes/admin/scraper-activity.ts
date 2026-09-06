import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  scrapeSourceRuns,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import type {
  AdminScraperActivityCountsSchema,
  AdminScraperRecordTypeSchema,
} from "@peated/server/schemas";
import { AdminScraperActivitySchema } from "@peated/server/schemas";
import { desc, eq, gte } from "drizzle-orm";
import type { z } from "zod";

const DAYS = 30;
const RECORD_TYPES = [
  "review",
  "price",
  "catalog",
  "bottle",
  "untracked",
] as const;

type ActivityCounts = z.infer<typeof AdminScraperActivityCountsSchema>;
type RecordType = z.infer<typeof AdminScraperRecordTypeSchema>;

function emptyCounts(): ActivityCounts {
  return {
    requests: 0,
    requestErrors: 0,
    requestErrorsComplete: true,
    runs: 0,
    failedRuns: 0,
    records: 0,
    newRecords: 0,
    existingRecords: 0,
    untrackedRecords: 0,
  };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addRun(
  counts: ActivityCounts,
  run: typeof externalSiteRuns.$inferSelect,
) {
  const untrackedRecords = Math.max(
    0,
    run.emittedItemCount - run.newItemCount - run.existingItemCount,
  );
  counts.requests += run.requestCount;
  counts.requestErrors += run.requestErrorCount ?? 0;
  if (run.requestCount > 0 && run.requestErrorCount === null) {
    counts.requestErrorsComplete = false;
  }
  counts.runs += 1;
  counts.failedRuns += run.status === "failed" ? 1 : 0;
  counts.records += run.emittedItemCount;
  counts.newRecords += run.newItemCount;
  counts.existingRecords += run.existingItemCount;
  counts.untrackedRecords += untrackedRecords;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/scrapers/activity",
    summary: "Get scraper activity",
    description:
      "Get daily scraper requests, runs, records, and recent failures for the admin homepage.",
    operationId: "getScraperActivity",
  })
  .output(AdminScraperActivitySchema)
  .handler(async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const firstDay = new Date(today);
    firstDay.setUTCDate(firstDay.getUTCDate() - (DAYS - 1));

    const rows = await db
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
      .orderBy(desc(externalSiteRuns.createdAt));
    const collectionRows = rows.filter(
      ({ run, sourcePurpose }) => (sourcePurpose ?? run.purpose) === "collect",
    );

    const totals = emptyCounts();
    const days = new Map<string, ActivityCounts>();
    for (let offset = 0; offset < DAYS; offset += 1) {
      const date = new Date(firstDay);
      date.setUTCDate(date.getUTCDate() + offset);
      days.set(dayKey(date), emptyCounts());
    }
    const recordTypes = new Map<RecordType, ActivityCounts>(
      RECORD_TYPES.map((type) => [type, emptyCounts()]),
    );

    for (const { run } of collectionRows) {
      const date = dayKey(run.startedAt ?? run.createdAt);
      const day = days.get(date);
      if (!day) continue;
      addRun(totals, run);
      addRun(day, run);
      addRun(recordTypes.get(run.recordType ?? "untracked")!, run);
    }

    return {
      totals,
      days: [...days.entries()]
        .reverse()
        .map(([date, counts]) => ({ date, ...counts })),
      recordTypes: RECORD_TYPES.map((type) => ({
        type,
        records: recordTypes.get(type)!.records,
        newRecords: recordTypes.get(type)!.newRecords,
        existingRecords: recordTypes.get(type)!.existingRecords,
        untrackedRecords: recordTypes.get(type)!.untrackedRecords,
      })),
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
