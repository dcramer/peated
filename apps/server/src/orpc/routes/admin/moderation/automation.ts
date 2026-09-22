import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  incomingBottleDecisionLogs,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { FAILED_JOB_RETENTION_MS, getQueue } from "@peated/server/worker/queue";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { ModerationAutomationResponseSchema } from "./schemas";

const LISTING_AUTOMATION_SAMPLE_SIZE = 100;

type CompletedListingAttempt = Pick<
  typeof storePriceMatchAttempts.$inferSelect,
  "automationEligible" | "finalStatus" | "initialStatus" | "proposalType"
>;

function summarizeListingOutcomes(attempts: CompletedListingAttempt[]) {
  let automatic = 0;
  let failed = 0;

  for (const attempt of attempts) {
    if (attempt.finalStatus === "errored") {
      failed += 1;
      continue;
    }

    if (
      (attempt.finalStatus === "approved" ||
        attempt.finalStatus === "ignored") &&
      (attempt.initialStatus === "verified" ||
        attempt.initialStatus === "ignored" ||
        attempt.automationEligible)
    ) {
      automatic += 1;
    }
  }

  const manual = attempts.length - automatic - failed;
  return {
    sampleSize: attempts.length,
    automatic,
    manual,
    failed,
    rate:
      attempts.length > 0
        ? Math.round((automatic / attempts.length) * 100)
        : null,
  };
}

const listingProposalTypes = [
  "match_existing",
  "create_new",
  "correction",
  "no_match",
] as const;

export function summarizeListingAutomation(
  attempts: CompletedListingAttempt[],
) {
  return {
    ...summarizeListingOutcomes(attempts),
    byProposalType: listingProposalTypes.flatMap((proposalType) => {
      const summary = summarizeListingOutcomes(
        attempts.filter((attempt) => attempt.proposalType === proposalType),
      );
      return summary.rate === null
        ? []
        : [{ proposalType, ...summary, rate: summary.rate }];
    }),
  };
}

const FAILED_LIST_LIMIT = 25;

export type FailedQueueJob = {
  id: string;
  name: string;
  error: string | null;
  failedAt: Date;
};

export type ModerationQueueLoader = () => Promise<{
  counts: {
    active?: number;
    completed?: number;
    failed?: number;
    wait?: number;
  };
  failedJobs: FailedQueueJob[];
}>;

const loadQueueState: ModerationQueueLoader = async () => {
  const queue = await getQueue("default");
  const [counts, failed] = await Promise.all([
    queue.getJobCounts("wait", "active", "completed", "failed"),
    queue.getFailed(0, FAILED_LIST_LIMIT - 1),
  ]);
  return {
    counts,
    failedJobs: failed.map((job) => ({
      id: String(job.id),
      name: job.name,
      error: job.failedReason || null,
      failedAt: new Date(job.finishedOn ?? job.timestamp),
    })),
  };
};

export function createModerationAutomationProcedure(
  getQueueState: ModerationQueueLoader = loadQueueState,
) {
  return procedure
    .use(requireMod)
    .route({
      method: "GET",
      path: "/admin/moderation/automation",
      summary: "Get moderation automation overview",
      description:
        "Read bounded processing, retry, and post-decision recovery state. Requires a moderator or administrator.",
      operationId: "getModerationAutomation",
    })
    .output(ModerationAutomationResponseSchema)
    .handler(async () => {
      const { counts: queueCounts, failedJobs } = await getQueueState();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      // Background work rule (moderation): failed work stays visible for the
      // failed job retention window, then it ages out of counts and lists.
      const failedSince = new Date(Date.now() - FAILED_JOB_RETENTION_MS);
      const retryFailedAt = sql`coalesce(${storePriceMatchRetryRuns.completedAt}, ${storePriceMatchRetryRuns.updatedAt})`;
      const recentlyFailedRetry = and(
        eq(storePriceMatchRetryRuns.status, "failed"),
        gte(retryFailedAt, failedSince),
      );

      // Health totals cover all durable work; limits apply only to rendered lists.
      // Moderation owns open audit failures; closed audit records remain in History.
      const [
        proposalCounts,
        operationCounts,
        decisionCounts,
        recentListingAttempts,
        retryCounts,
        recentRetryRuns,
        failedRetries,
      ] = await Promise.all([
        db
          .select({
            processing: sql<number>`count(*) filter (where ${storePriceMatchProposals.processingExpiresAt} > NOW())::int`,
          })
          .from(storePriceMatchProposals),
        db
          .select({
            processing: sql<number>`count(*) filter (where ${bottleChecks.closedAt} IS NULL AND ${bottleOperations.status} = 'applying')::int`,
            failed: sql<number>`count(*) filter (where ${bottleChecks.closedAt} IS NULL AND ${bottleOperations.status} IN ('stale', 'failed'))::int`,
            clearedToday: sql<number>`count(*) filter (where ${bottleOperations.executionCompletedAt} >= ${startOfToday} OR (${bottleOperations.reviewedAt} >= ${startOfToday} AND ${bottleOperations.status} = 'rejected'))::int`,
          })
          .from(bottleOperations)
          .innerJoin(
            bottleChecks,
            eq(bottleChecks.id, bottleOperations.checkId),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(incomingBottleDecisionLogs)
          .where(gte(incomingBottleDecisionLogs.createdAt, startOfToday)),
        db
          .select({
            automationEligible: storePriceMatchAttempts.automationEligible,
            finalStatus: storePriceMatchAttempts.finalStatus,
            initialStatus: storePriceMatchAttempts.initialStatus,
            proposalType: storePriceMatchAttempts.proposalType,
          })
          .from(storePriceMatchAttempts)
          .where(isNotNull(storePriceMatchAttempts.finalStatus))
          .orderBy(desc(storePriceMatchAttempts.id))
          .limit(LISTING_AUTOMATION_SAMPLE_SIZE),
        db
          .select({
            processing: sql<number>`count(*) filter (where ${storePriceMatchRetryRuns.status} IN ('pending', 'running'))::int`,
            failed: sql<number>`count(*) filter (where ${recentlyFailedRetry})::int`,
            completedToday: sql<number>`count(*) filter (where ${storePriceMatchRetryRuns.status} = 'completed' AND ${storePriceMatchRetryRuns.completedAt} >= ${startOfToday})::int`,
          })
          .from(storePriceMatchRetryRuns),
        db
          .select()
          .from(storePriceMatchRetryRuns)
          .orderBy(desc(storePriceMatchRetryRuns.createdAt))
          .limit(10),
        db
          .select()
          .from(storePriceMatchRetryRuns)
          .where(recentlyFailedRetry)
          .orderBy(desc(retryFailedAt))
          .limit(FAILED_LIST_LIMIT),
      ]);

      const failedOperations = await db
        .select({ operation: bottleOperations })
        .from(bottleOperations)
        .innerJoin(bottleChecks, eq(bottleChecks.id, bottleOperations.checkId))
        .where(
          and(
            inArray(bottleOperations.status, ["stale", "failed"]),
            isNull(bottleChecks.closedAt),
          ),
        )
        .orderBy(desc(bottleOperations.updatedAt))
        .limit(FAILED_LIST_LIMIT);
      return {
        generatedAt: new Date().toISOString(),
        counts: {
          processing:
            (queueCounts.active ?? 0) +
            (proposalCounts[0]?.processing ?? 0) +
            (operationCounts[0]?.processing ?? 0) +
            (retryCounts[0]?.processing ?? 0),
          waiting: queueCounts.wait ?? 0,
          failed:
            (queueCounts.failed ?? 0) +
            (operationCounts[0]?.failed ?? 0) +
            (retryCounts[0]?.failed ?? 0),
          clearedToday:
            (decisionCounts[0]?.count ?? 0) +
            (operationCounts[0]?.clearedToday ?? 0) +
            (retryCounts[0]?.completedToday ?? 0),
        },
        listingAutomation: summarizeListingAutomation(recentListingAttempts),
        needsAttention: [
          ...failedOperations.map(({ operation }) => ({
            key: `operation:${operation.id}`,
            kind: "operation" as const,
            title: `Catalog change #${operation.id}`,
            status: operation.status,
            detail: operation.error,
            href: `/admin/moderation/history/operation/${operation.id}`,
            occurredAt: operation.updatedAt.toISOString(),
          })),
          ...failedRetries.map((run) => ({
            key: `retry_run:${run.id}`,
            kind: "retry_run" as const,
            title: `Price retry #${run.id}`,
            status: run.status,
            detail: run.error,
            href: `/admin/moderation/automation?run=${run.id}`,
            occurredAt: (run.completedAt ?? run.updatedAt).toISOString(),
          })),
          ...failedJobs.map((job) => ({
            key: `job:${job.id}`,
            kind: "job" as const,
            title: `Job ${job.name}`,
            status: "failed",
            detail: job.error,
            href: null,
            occurredAt: job.failedAt.toISOString(),
          })),
        ],
        recentRuns: recentRetryRuns.map((run) => ({
          key: `retry_run:${run.id}`,
          kind: "retry_run" as const,
          title: run.query || "All matching listings",
          status: run.status,
          detail: `${run.processedCount} of ${run.matchedCount} checked`,
          href: `/admin/moderation/automation?run=${run.id}`,
          occurredAt: run.createdAt.toISOString(),
        })),
      };
    });
}

export default createModerationAutomationProcedure();
