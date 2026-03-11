import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import {
  applyApprovedStorePriceMatch,
  ignoreStorePriceMatchProposal,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = z
  .object({
    proposal: z.coerce.number(),
    action: z.enum(["match", "ignore"]),
    bottle: z.coerce.number().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.action === "match" && !input.bottle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bottle"],
        message: "Bottle is required when approving a match.",
      });
    }
  });

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}",
    summary: "Resolve price match queue item",
    description:
      "Approve or ignore a store price match proposal. Requires moderator privileges",
    operationId: "resolvePriceMatchQueueItem",
  })
  .input(InputSchema)
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    try {
      if (input.action === "match") {
        await applyApprovedStorePriceMatch({
          proposalId: input.proposal,
          bottleId: input.bottle!,
          reviewedById: context.user.id,
        });
        return {};
      }

      await ignoreStorePriceMatchProposal({
        proposalId: input.proposal,
        reviewedById: context.user.id,
      });
      return {};
    } catch (err) {
      if (err instanceof UnknownStorePriceMatchProposalError) {
        throw errors.NOT_FOUND({
          message: err.message,
        });
      }
      if (err instanceof StorePriceMatchProposalNotReviewableError) {
        throw errors.CONFLICT({
          message: err.message,
        });
      }
      if (err instanceof DuplicateBottleAliasError) {
        throw errors.CONFLICT({
          message: err.message,
        });
      }
      if (err instanceof FailedToSaveBottleAliasError) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: err.message,
        });
      }
      throw err;
    }
  });
