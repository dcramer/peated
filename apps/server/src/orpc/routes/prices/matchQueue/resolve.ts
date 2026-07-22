import { getUserActor } from "@peated/server/lib/actors";
import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import { CatalogTargetResolutionError } from "@peated/server/lib/catalogTargets";
import {
  applyApprovedStorePriceMatch,
  ignoreStorePriceMatchProposal,
  StorePriceMatchProposalAlreadyProcessingError,
  StorePriceMatchProposalIdentityChangedError,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = z.discriminatedUnion("action", [
  z
    .object({
      proposal: z.coerce.number().int().positive(),
      action: z.literal("match"),
      target: z.coerce.number().int().positive(),
    })
    .strict(),
  z
    .object({
      proposal: z.coerce.number().int().positive(),
      action: z.literal("ignore"),
    })
    .strict(),
]);

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
          targetId: input.target,
          reviewedById: context.user.id,
          actor: await getUserActor(context.user),
        });
        return {};
      }

      await ignoreStorePriceMatchProposal({
        proposalId: input.proposal,
        reviewedById: context.user.id,
        actor: await getUserActor(context.user),
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
      if (err instanceof StorePriceMatchProposalAlreadyProcessingError) {
        throw errors.CONFLICT({
          message: err.message,
        });
      }
      if (err instanceof StorePriceMatchProposalIdentityChangedError) {
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
      if (err instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: err.message, cause: err });
      }
      throw err;
    }
  });
