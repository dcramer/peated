import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { QueueRetryAllInputSchema, getQueueWhere } from "./filters";
import { enqueueStorePriceMatchRetry } from "./retry-utils";

const OutputSchema = z.object({
  matchedCount: z.number().int().min(0),
  enqueuedCount: z.number().int().min(0),
  alreadyProcessingCount: z.number().int().min(0),
  enqueueFailedCount: z.number().int().min(0),
});
const RETRY_ALL_BATCH_SIZE = 100;

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/retry",
    summary: "Retry filtered price match queue items",
    description:
      "Requeue all actionable price match proposals that match the current search filters. Requires moderator privileges",
    operationId: "retryPriceMatchQueueItems",
  })
  .input(QueueRetryAllInputSchema)
  .output(OutputSchema)
  .handler(async function ({ input }) {
    const actionableWhere = getQueueWhere({
      ...input,
      state: "actionable",
    });
    const [countRow] = await db
      .select({
        matchedCount: sql<number>`count(*)::int`,
        maxProposalId: sql<
          number | null
        >`max(${storePriceMatchProposals.id})::int`,
      })
      .from(storePriceMatchProposals)
      .innerJoin(
        storePrices,
        eq(storePrices.id, storePriceMatchProposals.priceId),
      )
      .where(actionableWhere);

    const result = {
      matchedCount: countRow?.matchedCount ?? 0,
      enqueuedCount: 0,
      alreadyProcessingCount: 0,
      enqueueFailedCount: 0,
    };

    let lastProposalId: number | null = null;
    const maxProposalId = countRow?.maxProposalId ?? null;

    let hasMore = true;

    while (hasMore) {
      const batch = await db
        .select({
          proposalId: storePriceMatchProposals.id,
          priceId: storePriceMatchProposals.priceId,
        })
        .from(storePriceMatchProposals)
        .innerJoin(
          storePrices,
          eq(storePrices.id, storePriceMatchProposals.priceId),
        )
        .where(
          and(
            actionableWhere,
            maxProposalId !== null
              ? sql`${storePriceMatchProposals.id} <= ${maxProposalId}`
              : undefined,
            lastProposalId !== null
              ? gt(storePriceMatchProposals.id, lastProposalId)
              : undefined,
          ),
        )
        .orderBy(asc(storePriceMatchProposals.id))
        .limit(RETRY_ALL_BATCH_SIZE);

      hasMore = batch.length === RETRY_ALL_BATCH_SIZE;

      if (!batch.length) {
        return result;
      }

      lastProposalId = batch[batch.length - 1]?.proposalId ?? null;

      const batchResults = await Promise.all(
        batch.map(async ({ proposalId, priceId }) => {
          try {
            return await enqueueStorePriceMatchRetry({
              proposalId,
              priceId,
            });
          } catch {
            return {
              status: "enqueue_failed" as const,
            };
          }
        }),
      );

      for (const batchResult of batchResults) {
        if (batchResult.status === "queued") {
          result.enqueuedCount += 1;
          continue;
        }

        if (batchResult.status === "enqueue_failed") {
          result.enqueueFailedCount += 1;
          continue;
        }

        result.alreadyProcessingCount += 1;
      }
    }

    return result;
  });
