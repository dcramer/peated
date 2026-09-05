import { db } from "@peated/server/db";
import {
  bottleOperations,
  incomingBottleDecisionLogs,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { getQueue } from "@peated/server/worker/queue";
import { desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { ModerationAutomationResponseSchema } from "./schemas";

const LISTING_AUTOMATION_SAMPLE_SIZE = 100;

type CompletedListingAttempt = Pick<
  typeof storePriceMatchAttempts.$inferSelect,
  "automationEligible" | "finalStatus" | "initialStatus"
>;

export function summarizeListingAutomation(
  attempts: CompletedListingAttempt[],
) {
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

export type ModerationQueueCountLoader = () => Promise<{
  active?: number;
  completed?: number;
  failed?: number;
  wait?: number;
}>;

const loadQueueCounts: ModerationQueueCountLoader = async () => {
  const queue = await getQueue("default");
  return await queue.getJobCounts("wait", "active", "completed", "failed");
};

export function createModerationAutomationProcedure(
  getQueueCounts: ModerationQueueCountLoader = loadQueueCounts,
) {
  return procedure
    .use(requireAdmin)
    .route({
      method: "GET",
      path: "/admin/moderation/automation",
      summary: "Get moderation automation overview",
      description:
        "Read bounded processing, retry, and post-decision recovery state. Requires administrator privileges.",
      operationId: "getModerationAutomation",
    })
    .output(ModerationAutomationResponseSchema)
    .handler(async () => {
      const queueCounts = await getQueueCounts();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // Health totals cover all durable work; limits apply only to rendered lists.
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
            processing: sql<number>`count(*) filter (where ${bottleOperations.status} = 'applying')::int`,
            failed: sql<number>`count(*) filter (where ${bottleOperations.status} IN ('stale', 'failed'))::int`,
            clearedToday: sql<number>`count(*) filter (where ${bottleOperations.executionCompletedAt} >= ${startOfToday} OR (${bottleOperations.reviewedAt} >= ${startOfToday} AND ${bottleOperations.status} = 'rejected'))::int`,
          })
          .from(bottleOperations),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(incomingBottleDecisionLogs)
          .where(gte(incomingBottleDecisionLogs.createdAt, startOfToday)),
        db
          .select({
            automationEligible: storePriceMatchAttempts.automationEligible,
            finalStatus: storePriceMatchAttempts.finalStatus,
            initialStatus: storePriceMatchAttempts.initialStatus,
          })
          .from(storePriceMatchAttempts)
          .where(isNotNull(storePriceMatchAttempts.finalStatus))
          .orderBy(desc(storePriceMatchAttempts.id))
          .limit(LISTING_AUTOMATION_SAMPLE_SIZE),
        db
          .select({
            processing: sql<number>`count(*) filter (where ${storePriceMatchRetryRuns.status} IN ('pending', 'running'))::int`,
            failed: sql<number>`count(*) filter (where ${storePriceMatchRetryRuns.status} = 'failed')::int`,
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
          .where(eq(storePriceMatchRetryRuns.status, "failed"))
          .orderBy(desc(storePriceMatchRetryRuns.updatedAt))
          .limit(25),
      ]);

      const failedOperations = await db
        .select()
        .from(bottleOperations)
        .where(inArray(bottleOperations.status, ["stale", "failed"]))
        .orderBy(desc(bottleOperations.updatedAt))
        .limit(25);
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
          ...failedOperations.map((operation) => ({
            key: `operation:${operation.id}`,
            kind: "operation" as const,
            title: `Catalog operation #${operation.id}`,
            status: operation.status,
            detail: operation.error,
            href: "/admin/moderation/automation",
            occurredAt: operation.updatedAt.toISOString(),
          })),
          ...failedRetries.map((run) => ({
            key: `retry_run:${run.id}`,
            kind: "retry_run" as const,
            title: `Listing retry run #${run.id}`,
            status: run.status,
            detail: run.error,
            href: `/admin/moderation/automation?run=${run.id}`,
            occurredAt: (run.completedAt ?? run.updatedAt).toISOString(),
          })),
        ],
        recentRuns: recentRetryRuns.map((run) => ({
          key: `retry_run:${run.id}`,
          kind: "retry_run" as const,
          title: run.query || "All matching listings",
          status: run.status,
          detail: `${run.processedCount} of ${run.matchedCount} processed`,
          href: `/admin/moderation/automation?run=${run.id}`,
          occurredAt: run.createdAt.toISOString(),
        })),
      };
    });
}

export default createModerationAutomationProcedure();
