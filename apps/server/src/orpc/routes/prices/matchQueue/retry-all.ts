import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePriceMatchRetryRunItems,
  storePriceMatchRetryRuns,
  storePrices,
} from "@peated/server/db/schema";
import {
  enqueueStorePriceMatchRetryRunJob,
  serializeStorePriceMatchRetryRun,
} from "@peated/server/lib/storePriceMatchRetryRuns";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { QueueKindSchema, getQueueWhere } from "./filters";
import { PriceMatchRetryRunSchema } from "./retry-run-schema";

const RETRY_RUN_SNAPSHOT_BATCH_SIZE = 500;
const RETRY_RUN_START_LOCK_ID = 94031817;

const InputSchema = z
  .object({
    query: z.string().default(""),
    kind: QueueKindSchema,
    mode: z.enum(["no_web", "full"]).default("no_web"),
  })
  .default({
    query: "",
    kind: null,
    mode: "no_web",
  });

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/retry",
    summary: "Start a filtered price match retry run",
    description:
      "Create a background retry run for actionable price match proposals that match the current search filters. Requires moderator privileges",
    operationId: "retryPriceMatchQueueItems",
  })
  .input(InputSchema)
  .output(PriceMatchRetryRunSchema)
  .handler(async function ({ input, context, errors }) {
    let run = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${RETRY_RUN_START_LOCK_ID})`,
      );

      const activeRun = await tx.query.storePriceMatchRetryRuns.findFirst({
        where: inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
      });

      if (activeRun) {
        throw errors.CONFLICT({
          message: `Retry run ${activeRun.id} is already ${activeRun.status}.`,
        });
      }

      const actionableWhere = getQueueWhere({
        ...input,
        state: "actionable",
      });
      const [countRow] = await tx
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
      const matchedCount = countRow?.matchedCount ?? 0;
      const maxProposalId = countRow?.maxProposalId ?? null;

      let [run] = await tx
        .insert(storePriceMatchRetryRuns)
        .values({
          completedAt: matchedCount === 0 ? sql`NOW()` : null,
          createdById: context.user.id,
          kind: input.kind,
          matchedCount,
          mode: input.mode,
          query: input.query,
          status: matchedCount === 0 ? "completed" : "pending",
        })
        .returning();

      if (!run) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Unable to create retry run.",
        });
      }

      let lastProposalId: number | null = null;
      let hasMore = matchedCount > 0;
      let snapshottedCount = 0;

      while (hasMore) {
        const batch = await tx
          .select({
            priceId: storePriceMatchProposals.priceId,
            proposalId: storePriceMatchProposals.id,
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
          .limit(RETRY_RUN_SNAPSHOT_BATCH_SIZE);

        hasMore = batch.length === RETRY_RUN_SNAPSHOT_BATCH_SIZE;

        if (!batch.length) {
          break;
        }

        lastProposalId = batch[batch.length - 1]?.proposalId ?? null;

        await tx
          .insert(storePriceMatchRetryRunItems)
          .values(
            batch.map(({ priceId, proposalId }) => ({
              priceId,
              proposalId,
              runId: run.id,
            })),
          )
          .onConflictDoNothing();
        snapshottedCount += batch.length;
      }

      [run] = await tx
        .update(storePriceMatchRetryRuns)
        .set({
          completedAt: snapshottedCount === 0 ? sql`NOW()` : null,
          matchedCount: snapshottedCount,
          status: snapshottedCount === 0 ? "completed" : "pending",
          updatedAt: sql`NOW()`,
        })
        .where(eq(storePriceMatchRetryRuns.id, run.id))
        .returning();

      if (!run) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Unable to update retry run.",
        });
      }

      return run;
    });

    if (run.matchedCount > 0) {
      try {
        await enqueueStorePriceMatchRetryRunJob({ runId: run.id });
      } catch (error) {
        [run] = await db
          .update(storePriceMatchRetryRuns)
          .set({
            error:
              error instanceof Error
                ? error.message
                : "Unable to enqueue retry run.",
            status: "failed",
            updatedAt: sql`NOW()`,
          })
          .where(eq(storePriceMatchRetryRuns.id, run.id))
          .returning();

        throw errors.INTERNAL_SERVER_ERROR({
          message: run?.error ?? "Unable to enqueue retry run.",
        });
      }
    }

    return serializeStorePriceMatchRetryRun(run);
  });
