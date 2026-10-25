import { storePriceMatchProposals } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  StorePriceMatchQueueItemSchema,
  detailsResponse,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getQueueItem } from "./utils";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/{price}/match-proposal",
    summary: "Get a price's match proposal",
    description:
      "Retrieve the match proposal for one store price in any status, including approved and ignored proposals. Use its `id`, `updatedAt`, and `price.sourceFingerprint` to reopen a wrong match. Returns `404` when the price has no proposal. Requires moderator privileges.",
    operationId: "getPriceMatchProposal",
  })
  .input(
    z.object({
      price: z.coerce.number().int().positive().describe("Store price ID"),
    }),
  )
  .output(detailsResponse(StorePriceMatchQueueItemSchema))
  .handler(async function ({ input, context, errors }) {
    // Each store price has at most one proposal (unique on price ID).
    const result = await getQueueItem(
      eq(storePriceMatchProposals.priceId, input.price),
      context,
      { caller: "prices.matchQueue.priceDetails", operation: "hydrate" },
    );
    if (!result) {
      throw errors.NOT_FOUND({
        message: "This price has no match proposal.",
      });
    }
    return result;
  });
