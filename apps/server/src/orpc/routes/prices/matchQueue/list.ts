import { db } from "@peated/server/db";
import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getProposalBottles } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { StorePriceMatchQueueListResponse } from "@peated/server/schemas";
import { desc, eq, sql } from "drizzle-orm";
import {
  getQueueBaseWhere,
  getQueueIsProcessingSql,
  getQueueStateFilter,
  getQueueWhere,
  QueueListInputSchema,
} from "./filters";
import { serializeQueueItems } from "./utils";

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
  .handler(async function ({ input, context }) {
    const offset = (input.cursor - 1) * input.limit;
    const baseWhere = getQueueBaseWhere(input);
    const queueWhere = getQueueWhere(input);
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
      .where(baseWhere);
    const orderBy =
      input.state === "processing"
        ? [
            desc(storePriceMatchProposals.processingQueuedAt),
            desc(storePriceMatchProposals.id),
          ]
        : [
            desc(storePriceMatchProposals.updatedAt),
            desc(storePriceMatchProposals.id),
          ];

    const rows = await db
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
      .where(queueWhere)
      .orderBy(...orderBy)
      .limit(input.limit + 1)
      .offset(offset);

    const hasNextPage = rows.length > input.limit;
    const queueRows = rows.slice(0, input.limit).map((row) => ({
      isProcessing: row.isProcessing,
      proposal: row.proposal,
      price: {
        ...row.price,
        externalSite: row.site,
      },
    }));

    const bottleList = await getProposalBottles(
      queueRows.map((row) => row.proposal),
    );

    return {
      results: await serializeQueueItems(queueRows, bottleList, context),
      rel: {
        nextCursor: hasNextPage ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
      stats: {
        actionableCount: stats?.actionableCount ?? 0,
        processingCount: stats?.processingCount ?? 0,
      },
    };
  });
