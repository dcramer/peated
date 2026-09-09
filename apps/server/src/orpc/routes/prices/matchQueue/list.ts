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
  QueueListInputSchema,
} from "./filters";
import { serializeQueueItems } from "./utils";

type QueueStats = {
  actionableCount: number;
  processingCount: number;
};

function queueStatsSelection() {
  return {
    actionableCount:
      sql<number>`count(*) filter (where ${getQueueStateFilter("actionable")}) over()::int`.as(
        "actionable_count",
      ),
    processingCount:
      sql<number>`count(*) filter (where ${getQueueStateFilter("processing")}) over()::int`.as(
        "processing_count",
      ),
  };
}

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
    const baseWhere = getQueueBaseWhere(input);
    const queueMatches = db
      .select({
        proposalId: storePriceMatchProposals.id,
        createdAt: storePriceMatchProposals.createdAt,
        updatedAt: storePriceMatchProposals.updatedAt,
        processingQueuedAt: storePriceMatchProposals.processingQueuedAt,
        isProcessing: getQueueIsProcessingSql().as("is_processing"),
        ...queueStatsSelection(),
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
      .where(baseWhere)
      .as("queue_matches");

    const queueStateWhere = eq(
      queueMatches.isProcessing,
      input.state === "processing",
    );
    const orderBy =
      input.sort === "created"
        ? [asc(queueMatches.createdAt), asc(queueMatches.proposalId)]
        : input.sort === "-created"
          ? [desc(queueMatches.createdAt), desc(queueMatches.proposalId)]
          : input.state === "processing"
            ? [
                desc(queueMatches.processingQueuedAt),
                desc(queueMatches.proposalId),
              ]
            : [desc(queueMatches.updatedAt), desc(queueMatches.proposalId)];

    const rows = await db
      .select({
        isProcessing: queueMatches.isProcessing,
        actionableCount: queueMatches.actionableCount,
        processingCount: queueMatches.processingCount,
        proposal: storePriceMatchProposals,
        price: storePrices,
        site: externalSites,
      })
      .from(queueMatches)
      .innerJoin(
        storePriceMatchProposals,
        eq(storePriceMatchProposals.id, queueMatches.proposalId),
      )
      .innerJoin(
        storePrices,
        eq(storePrices.id, storePriceMatchProposals.priceId),
      )
      .innerJoin(
        externalSites,
        eq(externalSites.id, storePrices.externalSiteId),
      )
      .where(queueStateWhere)
      .orderBy(...orderBy)
      .limit(input.limit + 1)
      .offset(offset);

    // Queue list rule: count both states from the same filtered scan as the
    // page. Only run the separate count when the requested page has no rows.
    const stats = rows[0]
      ? {
          actionableCount: rows[0].actionableCount,
          processingCount: rows[0].processingCount,
        }
      : await queryQueueStats(baseWhere);

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
