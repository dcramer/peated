import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { logError, logInfo } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { desc, eq, sql } from "drizzle-orm";

type ReconcileStorePriceMatchProposalsArgs = {
  limit?: number;
  minAgeMinutes?: number;
};

export type ReconcileStorePriceMatchProposalsServices = {
  enqueuePriceResolution: (priceId: number) => Promise<void>;
};

const defaultServices: ReconcileStorePriceMatchProposalsServices = {
  enqueuePriceResolution: async (priceId) => {
    // Worker queue rule: use the scraper's unique job ID so a listing that is
    // still waiting is not queued again. Otherwise every hourly run re-adds
    // the same listings while the models queue is behind, and the backlog
    // feeds itself. A finished job with this ID is removed before re-adding.
    await pushUniqueJob("ResolveStorePriceBottle", { priceId });
  },
};

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * Reconciles unresolved store prices that never produced match proposals.
 *
 * The matcher still owns proposal creation; this job only redispatches eligible
 * visible rows and relies on the proposal table to bound durable duplicates.
 */
export async function reconcileStorePriceMatchProposals(
  {
    limit: inputLimit = 500,
    minAgeMinutes: inputMinAgeMinutes = 30,
  }: ReconcileStorePriceMatchProposalsArgs = {},
  services: ReconcileStorePriceMatchProposalsServices = defaultServices,
) {
  const limit = clampInteger(inputLimit, 1, 1000);
  const minAgeMinutes = clampInteger(inputMinAgeMinutes, 0, 60 * 24 * 30);

  const prices = await db
    .select({
      id: storePrices.id,
    })
    .from(storePrices)
    .leftJoin(
      storePriceMatchProposals,
      eq(storePriceMatchProposals.priceId, storePrices.id),
    )
    .where(
      sql`${storePrices.hidden} = false
        AND ${storePrices.bottleId} IS NULL
        AND ${storePriceMatchProposals.id} IS NULL
        AND ${storePrices.updatedAt} <= NOW() - make_interval(mins => ${minAgeMinutes})`,
    )
    .orderBy(desc(storePrices.updatedAt), desc(storePrices.id))
    .limit(limit);

  let queuedCount = 0;

  for (const price of prices) {
    try {
      await services.enqueuePriceResolution(price.id);
      queuedCount += 1;
    } catch (error) {
      logError(error, {
        price: {
          id: price.id,
        },
      });
    }
  }

  if (queuedCount > 0) {
    logInfo("Queued unmatched store prices without match proposals", {
      extra: {
        queuedCount,
      },
    });
  }

  return {
    queuedCount,
  };
}

export default async function reconcileStorePriceMatchProposalsJob(
  args: ReconcileStorePriceMatchProposalsArgs = {},
) {
  return await reconcileStorePriceMatchProposals(args);
}
