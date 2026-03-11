import { db } from "@peated/server/db";
import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
  createBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  applyApprovedStorePriceMatchProposalInTransaction,
  getStorePriceMatchProposalForReviewInTransaction,
  InvalidStorePriceMatchProposalTypeError,
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
      const result = await db.transaction(async (tx) => {
        const proposal = await getStorePriceMatchProposalForReviewInTransaction(
          tx,
          {
            proposalId: input.proposal,
            expectedProposalType: "create_new",
            allowedStatuses: ["pending_review"],
          },
        );
        const createResult = await createBottleInTransaction(tx, {
          input: input.bottle,
          context,
        });
        const aliasResult =
          await applyApprovedStorePriceMatchProposalInTransaction(tx, {
            proposal,
            bottleId: createResult.bottle.id,
            reviewedById: context.user.id,
          });

        return {
          createResult,
          aliasResult,
        };
      });

      await finalizeCreatedBottle(result.createResult);
      await finalizeBottleAliasAssignment(result.aliasResult, {
        bottle: {
          id: result.createResult.bottle.id,
        },
      });

      return await serialize(
        BottleSerializer,
        result.createResult.bottle,
        context.user,
      );
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
