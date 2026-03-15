import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import {
  createBottleFromStorePriceMatchProposal,
  InvalidStorePriceMatchProposalTypeError,
  StorePriceMatchProposalAlreadyProcessingError,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleInputSchema, BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/prices/match-queue/{proposal}/create-bottle",
    summary: "Create bottle from price match proposal",
    description:
      "Create a new bottle from a store price match proposal and approve the proposal in a single transaction. Requires moderator privileges",
    operationId: "createBottleFromPriceMatchQueueItem",
  })
  .input(
    z.object({
      proposal: z.coerce.number(),
      bottle: BottleInputSchema,
    }),
  )
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const bottle = await createBottleFromStorePriceMatchProposal({
        proposalId: input.proposal,
        input: input.bottle,
        user: context.user,
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

      if (err instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
          data: {
            bottle: err.bottleId,
          },
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

      if (err instanceof BottleCreateBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
