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
    const result = await getQueueItem(
      eq(storePriceMatchProposals.id, input.proposal),
      context,
      { caller: "prices.matchQueue.details", operation: "hydrate" },
    );
    if (!result) {
      throw errors.NOT_FOUND({
        message: "Price match proposal not found.",
      });
    }
    return result;
  });
