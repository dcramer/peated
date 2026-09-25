import { db } from "@peated/server/db";
import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { StorePriceMatchQueueListResponse } from "@peated/server/schemas";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  getQueueBaseWhere,
  getQueueIsProcessingSql,
  getQueueStateFilter,
  getQueueWhere,
  QueueListInputSchema,
} from "./filters";
import { serializeQueueItems } from "./utils";

type QueueStats = {
  actionableCount: number;
  processingCount: number;
};

// Queue list rule: the page and the counts read the same filtered queue, so the
// counts stay true for the page. Count once instead of on every row.
async function queryQueueStats(baseWhere: SQL): Promise<QueueStats> {
  const [stats] = await db
    .select({
      actionableCount: sql<number>`count(*) filter (where ${getQueueStateFilter("actionable")})::int`,
      processingCount: sql<number>`count(*) filter (where ${getQueueStateFilter("processing")})::int`,
    })
    .from(storePriceMatchProposals)
    .innerJoin(
      storePrices,
      eq(storePrices.id, storePriceMatchProposals.priceId),
    )
    .innerJoin(externalSites, eq(externalSites.id, storePrices.externalSiteId))
    .where(baseWhere);

  return {
    actionableCount: stats?.actionableCount ?? 0,
    processingCount: stats?.processingCount ?? 0,
  };
}

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/match-queue",
    summary: "List price match queue items",
    description:
      "Retrieve pending or errored store price match proposals for moderator review. Requires moderator privileges",
    operationId: "listPriceMatchQueue",
  })
  .input(QueueListInputSchema)
  .output(StorePriceMatchQueueListResponse)
  .handler(async function ({ input, context, errors }) {
    const offset = (input.cursor - 1) * input.limit;
    const orderBy =
      input.sort === "created"
        ? [
            asc(storePriceMatchProposals.createdAt),
            asc(storePriceMatchProposals.id),
          ]
        : input.sort === "-created"
          ? [
              desc(storePriceMatchProposals.createdAt),
              desc(storePriceMatchProposals.id),
            ]
          : input.state === "processing"
            ? [
                desc(storePriceMatchProposals.processingQueuedAt),
                desc(storePriceMatchProposals.id),
              ]
            : [
                desc(storePriceMatchProposals.updatedAt),
                desc(storePriceMatchProposals.id),
              ];

    const [rows, stats] = await Promise.all([
      db
        .select({
          isProcessing: getQueueIsProcessingSql(),
          proposal: storePriceMatchProposals,
          price: storePrices,
          site: externalSites,
        })
        .from(storePriceMatchProposals)
        .innerJoin(
          storePrices,
          eq(storePrices.id, storePriceMatchProposals.priceId),
        )
        .innerJoin(
          externalSites,
          eq(externalSites.id, storePrices.externalSiteId),
        )
        .where(getQueueWhere(input))
        .orderBy(...orderBy)
        .limit(input.limit + 1)
        .offset(offset),
      queryQueueStats(getQueueBaseWhere(input)),
    ]);

    const hasNextPage = rows.length > input.limit;
    const queueRows = rows.slice(0, input.limit).map((row) => ({
      isProcessing: row.isProcessing,
      proposal: row.proposal,
      price: {
        ...row.price,
        externalSite: row.site,
      },
    }));

    const results = await serializeQueueItems(queueRows, context, {
      caller: "prices.matchQueue.list",
      operation: "hydrate",
    });

    return {
      results,
      rel: {
        nextCursor: hasNextPage ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
      stats: {
        actionableCount: stats.actionableCount,
        processingCount: stats.processingCount,
      },
    };
  });
