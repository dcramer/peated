import { db } from "@peated/server/db";
import { storePriceMatchProposals } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}/retry",
    summary: "Retry price match evaluation",
    description:
      "Requeue store price match evaluation for a specific proposal. Requires moderator privileges",
    operationId: "retryPriceMatchQueueItem",
  })
  .input(
    z.object({
      proposal: z.coerce.number(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    const proposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, input.proposal),
    });

    if (!proposal) {
      throw errors.NOT_FOUND({
        message: "Price match proposal not found.",
      });
    }

    await pushUniqueJob("ResolveStorePriceBottle", {
      priceId: proposal.priceId,
      force: true,
    });
    return {};
  });
