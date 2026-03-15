import { db } from "@peated/server/db";
import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getProposalBottles } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  StorePriceMatchQueueItemSchema,
  detailsResponse,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getQueueIsProcessingSql } from "./filters";
import { serializeQueueItems } from "./utils";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/match-queue/{proposal}",
    summary: "Get price match queue item",
    description:
      "Retrieve a single store price match proposal with current and suggested bottle context. Requires moderator privileges",
    operationId: "getPriceMatchQueueItem",
  })
  .input(
    z.object({
      proposal: z.coerce.number(),
    }),
  )
  .output(detailsResponse(StorePriceMatchQueueItemSchema))
  .handler(async function ({ input, context, errors }) {
    const [row] = await db
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
      .where(eq(storePriceMatchProposals.id, input.proposal))
      .limit(1);

    if (!row) {
      throw errors.NOT_FOUND({
        message: "Price match proposal not found.",
      });
    }

    const bottleList = await getProposalBottles([row.proposal]);
    const [result] = await serializeQueueItems(
      [
        {
          isProcessing: row.isProcessing,
          proposal: row.proposal,
          price: {
            ...row.price,
            externalSite: row.site,
          },
        },
      ],
      bottleList,
      context,
    );

    return result;
  });
