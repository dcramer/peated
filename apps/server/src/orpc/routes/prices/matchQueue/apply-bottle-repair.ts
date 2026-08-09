import { getUserActor } from "@peated/server/lib/actors";
import {
  ExactBottleAliasConflictError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import {
  applyStorePriceBottleRepairFromProposal,
  InvalidStorePriceMatchProposalTypeError,
  StorePriceBottleRepairBadRequestError,
  StorePriceMatchProposalAlreadyProcessingError,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import {
  BottleUpdateConflictError,
  BottleUpdateGraphError,
  BottleUpdateInputError,
} from "@peated/server/lib/updateBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}/apply-bottle-repair",
    summary: "Apply bottle repair from price match proposal",
    description:
      "Apply a same-bottle repair draft from a store price match proposal and approve the proposal in a single transaction. Requires moderator privileges",
    operationId: "applyBottleRepairFromPriceMatchQueueItem",
  })
  .input(
    z.object({
      proposal: z.coerce.number(),
    }),
  )
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const bottle = await applyStorePriceBottleRepairFromProposal({
        proposalId: input.proposal,
        user: context.user,
        actor: await getUserActor(context.user),
      });

      return await serialize(BottleSerializer, bottle, context.user);
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

      if (err instanceof InvalidStorePriceMatchProposalTypeError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      if (err instanceof StorePriceBottleRepairBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      if (err instanceof BottleUpdateInputError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      if (err instanceof BottleUpdateGraphError && err.code === "not_found") {
        throw errors.NOT_FOUND({
          message: err.message,
        });
      }

      if (err instanceof BottleUpdateGraphError) {
        throw errors.CONFLICT({
          message: err.message,
        });
      }

      if (err instanceof BottleUpdateConflictError) {
        throw errors.CONFLICT({
          message: err.message,
          data:
            err.conflictingBottleId === null
              ? undefined
              : { bottle: err.conflictingBottleId },
        });
      }

      if (err instanceof ExactBottleAliasConflictError) {
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
