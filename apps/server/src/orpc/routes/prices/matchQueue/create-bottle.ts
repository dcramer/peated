import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import {
  BottleReleaseAlreadyExistsError,
  BottleReleaseCreateBadRequestError,
} from "@peated/server/lib/createBottleRelease";
import {
  createBottleFromStorePriceMatchProposal,
  InvalidStorePriceMatchProposalTypeError,
  StorePriceMatchProposalAlreadyProcessingError,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  BottleInputSchema,
  BottleReleaseInputSchema,
  BottleReleaseSchema,
  BottleSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
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
    z
      .object({
        proposal: z.coerce.number(),
        bottle: BottleInputSchema.optional(),
        release: BottleReleaseInputSchema.optional(),
      })
      .superRefine((input, ctx) => {
        if (!input.bottle && !input.release) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bottle"],
            message: "Bottle or release input is required.",
          });
        }
      }),
  )
  .output(
    z.object({
      bottle: BottleSchema,
      release: BottleReleaseSchema.nullable(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await createBottleFromStorePriceMatchProposal({
        proposalId: input.proposal,
        input: input.bottle,
        releaseInput: input.release,
        user: context.user,
      });

      return {
        bottle: await serialize(BottleSerializer, result.bottle, context.user),
        release: result.release
          ? await serialize(
              BottleReleaseSerializer,
              result.release,
              context.user,
            )
          : null,
      };
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

      if (err instanceof BottleReleaseAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
        });
      }

      if (err instanceof BottleReleaseCreateBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
