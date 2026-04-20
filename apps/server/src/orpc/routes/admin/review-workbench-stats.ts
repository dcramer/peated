import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const REVIEW_WORKBENCH_PERIOD_DAYS = 14;

const ReviewWorkbenchDailyStatsSchema = z.object({
  date: z.string(),
  newListings: z.number().int().min(0),
  matchedSuccessfully: z.number().int().min(0),
  autoResolved: z.number().int().min(0),
  autoIgnored: z.number().int().min(0),
  sentToQueue: z.number().int().min(0),
  queueApproved: z.number().int().min(0),
  queueIgnored: z.number().int().min(0),
  queueOpen: z.number().int().min(0),
  queueErrored: z.number().int().min(0),
});

const ReviewWorkbenchStatsSchema = z.object({
  generatedAt: z.string().datetime(),
  windowDays: z.number().int().min(1),
  snapshot: z.object({
    today: ReviewWorkbenchDailyStatsSchema,
    backlog: z.object({
      actionable: z.number().int().min(0),
      processing: z.number().int().min(0),
      errored: z.number().int().min(0),
      olderThan24Hours: z.number().int().min(0),
      olderThan72Hours: z.number().int().min(0),
      oldestHours: z.number().min(0).nullable(),
    }),
  }),
  daily: z.array(ReviewWorkbenchDailyStatsSchema),
});

type ReviewWorkbenchDailyStats = z.infer<
  typeof ReviewWorkbenchDailyStatsSchema
>;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptyDailyStats(date: string): ReviewWorkbenchDailyStats {
  return {
    date,
    newListings: 0,
    matchedSuccessfully: 0,
    autoResolved: 0,
    autoIgnored: 0,
    sentToQueue: 0,
    queueApproved: 0,
    queueIgnored: 0,
    queueOpen: 0,
    queueErrored: 0,
  };
}

function didProposalRequireQueueReview(row: {
  enteredQueueAt: Date | null;
  status:
    | null
    | "approved"
    | "errored"
    | "ignored"
    | "pending_review"
    | "verified";
}) {
  return (
    row.enteredQueueAt !== null ||
    row.status === "pending_review" ||
    row.status === "errored"
  );
}

function roundHours(value: number | null): null | number {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/review-workbench/stats",
    summary: "Get review workbench stats",
    description:
      "Retrieve daily incoming listing throughput plus current queue aging and backlog metrics. Requires admin privileges",
    operationId: "getAdminReviewWorkbenchStats",
  })
  .output(ReviewWorkbenchStatsSchema)
  .handler(async function () {
    const today = startOfDay(new Date());
    const rangeStart = subtractDays(today, REVIEW_WORKBENCH_PERIOD_DAYS - 1);
    const dailyStats = new Map<string, ReviewWorkbenchDailyStats>();

    for (let index = 0; index < REVIEW_WORKBENCH_PERIOD_DAYS; index += 1) {
      const currentDate = subtractDays(today, index);
      const key = toDateKey(currentDate);
      dailyStats.set(key, createEmptyDailyStats(key));
    }

    const proposalRows = await db
      .select({
        createdAt: storePrices.createdAt,
        bottleId: storePrices.bottleId,
        enteredQueueAt: storePriceMatchProposals.enteredQueueAt,
        status: storePriceMatchProposals.status,
      })
      .from(storePrices)
      .leftJoin(
        storePriceMatchProposals,
        eq(storePriceMatchProposals.priceId, storePrices.id),
      )
      .where(
        and(
          eq(storePrices.hidden, false),
          gte(storePrices.createdAt, rangeStart),
        ),
      );

    for (const row of proposalRows) {
      const dateKey = toDateKey(row.createdAt);
      const dayStats = dailyStats.get(dateKey);

      if (!dayStats) {
        continue;
      }

      dayStats.newListings += 1;

      if (!row.status) {
        continue;
      }

      const requiredQueueReview = didProposalRequireQueueReview(row);
      const matchedSuccessfully =
        row.status === "approved" && row.bottleId !== null;

      if (matchedSuccessfully) {
        dayStats.matchedSuccessfully += 1;
        if (!requiredQueueReview) {
          dayStats.autoResolved += 1;
        }
      }

      if (row.status === "ignored" && !requiredQueueReview) {
        dayStats.autoIgnored += 1;
      }

      if (!requiredQueueReview) {
        continue;
      }

      dayStats.sentToQueue += 1;

      switch (row.status) {
        case "approved":
          dayStats.queueApproved += 1;
          break;
        case "ignored":
          dayStats.queueIgnored += 1;
          break;
        case "pending_review":
          dayStats.queueOpen += 1;
          break;
        case "errored":
          dayStats.queueErrored += 1;
          break;
      }
    }

    const actionableFilter = sql`${storePriceMatchProposals.status} IN ('pending_review', 'errored') AND (${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())`;
    const processingFilter = sql`${storePriceMatchProposals.status} IN ('pending_review', 'errored') AND ${storePriceMatchProposals.processingExpiresAt} IS NOT NULL AND ${storePriceMatchProposals.processingExpiresAt} > NOW()`;
    const actionableAgeBasis = sql`COALESCE(${storePriceMatchProposals.enteredQueueAt}, ${storePriceMatchProposals.createdAt})`;

    const [backlog] = await db
      .select({
        actionable: sql<number>`count(*) filter (where ${actionableFilter})::int`,
        processing: sql<number>`count(*) filter (where ${processingFilter})::int`,
        errored: sql<number>`count(*) filter (where ${actionableFilter} AND ${storePriceMatchProposals.status} = 'errored')::int`,
        olderThan24Hours: sql<number>`count(*) filter (where ${actionableFilter} AND ${actionableAgeBasis} <= NOW() - INTERVAL '24 hours')::int`,
        olderThan72Hours: sql<number>`count(*) filter (where ${actionableFilter} AND ${actionableAgeBasis} <= NOW() - INTERVAL '72 hours')::int`,
        oldestHours: sql<number>`max(extract(epoch from NOW() - ${actionableAgeBasis}) / 3600) filter (where ${actionableFilter})`,
      })
      .from(storePriceMatchProposals)
      .innerJoin(
        storePrices,
        eq(storePrices.id, storePriceMatchProposals.priceId),
      )
      .where(
        and(
          eq(storePrices.hidden, false),
          inArray(storePriceMatchProposals.status, [
            "pending_review",
            "errored",
          ]),
        ),
      );

    const sortedDailyStats = Array.from(dailyStats.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );

    return {
      generatedAt: new Date().toISOString(),
      windowDays: REVIEW_WORKBENCH_PERIOD_DAYS,
      snapshot: {
        today:
          dailyStats.get(toDateKey(today)) ??
          createEmptyDailyStats(toDateKey(today)),
        backlog: {
          actionable: backlog?.actionable ?? 0,
          processing: backlog?.processing ?? 0,
          errored: backlog?.errored ?? 0,
          olderThan24Hours: backlog?.olderThan24Hours ?? 0,
          olderThan72Hours: backlog?.olderThan72Hours ?? 0,
          oldestHours: roundHours(backlog?.oldestHours ?? null),
        },
      },
      daily: sortedDailyStats,
    };
  });
