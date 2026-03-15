import { db } from "@peated/server/db";
import { storePriceMatchProposals } from "@peated/server/db/schema";
import { StorePriceMatchProposalNotReviewableError } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { enqueueStorePriceMatchRetry } from "./retry-utils";

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
  .output(
    z.object({
      status: z.enum(["queued", "already_processing"]),
    }),
  )
  .handler(async function ({ input, errors }) {
    const proposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, input.proposal),
    });

    if (!proposal) {
      throw errors.NOT_FOUND({
        message: "Price match proposal not found.",
      });
    }

    const result = await enqueueStorePriceMatchRetry({
      proposalId: proposal.id,
      priceId: proposal.priceId,
    });

    if (result.status === "already_processing") {
      return {
        status: "already_processing",
      };
    }

    if (result.status === "not_retryable") {
      throw errors.CONFLICT({
        message: new StorePriceMatchProposalNotReviewableError(
          proposal.id,
          proposal.status,
        ).message,
      });
    }

    if (result.status === "not_found") {
      throw errors.NOT_FOUND({
        message: "Price match proposal not found.",
      });
    }

    return {
      status: "queued",
    };
  });
