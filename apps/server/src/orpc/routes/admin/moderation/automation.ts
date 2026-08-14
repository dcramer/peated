import { db } from "@peated/server/db";
import {
  bottleOperations,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { getQueue } from "@peated/server/worker/client";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { ModerationAutomationResponseSchema } from "./schemas";

export default procedure
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
    const queue = await getQueue("default");
    const queueCounts = await queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
    );
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [proposalCounts, operationCounts, decisionCounts, retryRuns] =
      await Promise.all([
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
          .select()
          .from(storePriceMatchRetryRuns)
          .orderBy(desc(storePriceMatchRetryRuns.createdAt))
          .limit(10),
      ]);

    const failedOperations = await db
      .select()
      .from(bottleOperations)
      .where(inArray(bottleOperations.status, ["stale", "failed"]))
      .orderBy(desc(bottleOperations.updatedAt))
      .limit(25);
    const processingRetries = retryRuns.filter(
      ({ status }) => status === "pending" || status === "running",
    ).length;
    const failedRetries = retryRuns.filter(({ status }) => status === "failed");
    const completedRetriesToday = retryRuns.filter(
      ({ completedAt, status }) =>
        status === "completed" && completedAt && completedAt >= startOfToday,
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        processing:
          (queueCounts.active ?? 0) +
          (proposalCounts[0]?.processing ?? 0) +
          (operationCounts[0]?.processing ?? 0) +
          processingRetries,
        waiting: queueCounts.wait ?? 0,
        failed:
          (queueCounts.failed ?? 0) +
          (operationCounts[0]?.failed ?? 0) +
          failedRetries.length,
        clearedToday:
          (decisionCounts[0]?.count ?? 0) +
          (operationCounts[0]?.clearedToday ?? 0) +
          completedRetriesToday,
      },
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
      recentRuns: retryRuns.map((run) => ({
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
