import { getUserActor } from "@peated/server/lib/actors";
import {
  DuplicateBottleAliasError,
  FailedToSaveBottleAliasError,
} from "@peated/server/lib/bottleAliases";
import { CatalogTargetResolutionError } from "@peated/server/lib/catalogTargets";
import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
  TrustedSourceBottleError,
} from "@peated/server/lib/createBottle";
import { buildIndependentConcreteBottleCreateInput } from "@peated/server/lib/flatConcreteBottleInput";
import { logInfo } from "@peated/server/lib/log";
import { InvalidPriceMatchConcreteBottleInputError } from "@peated/server/lib/priceMatchConcreteBottleInput";
import {
  createBottleFromStorePriceMatchProposal,
  InvalidStorePriceMatchProposalTypeError,
  StorePriceMatchProposalAlreadyProcessingError,
  StorePriceMatchProposalIdentityChangedError,
  StorePriceMatchProposalNotReviewableError,
  UnknownStorePriceMatchProposalError,
} from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  BottleInputSchema,
  BottleReleaseInputSchema,
  BottleSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";

function classifyCompatibilityRejection(error: unknown): string {
  if (error instanceof UnknownStorePriceMatchProposalError) {
    return "proposal_not_found";
  }
  if (error instanceof StorePriceMatchProposalNotReviewableError) {
    return "proposal_not_reviewable";
  }
  if (error instanceof StorePriceMatchProposalAlreadyProcessingError) {
    return "proposal_already_processing";
  }
  if (error instanceof StorePriceMatchProposalIdentityChangedError) {
    return "proposal_identity_changed";
  }
  if (error instanceof CatalogTargetResolutionError) {
    return "catalog_target_resolution";
  }
  if (error instanceof InvalidStorePriceMatchProposalTypeError) {
    return "invalid_proposal_type";
  }
  if (error instanceof BottleAlreadyExistsError) {
    return "bottle_already_exists";
  }
  if (error instanceof DuplicateBottleAliasError) {
    return "duplicate_bottle_alias";
  }
  if (error instanceof FailedToSaveBottleAliasError) {
    return "bottle_alias_persistence";
  }
  if (error instanceof BottleCreateBadRequestError) {
    return "invalid_bottle";
  }
  if (error instanceof InvalidPriceMatchConcreteBottleInputError) {
    return "invalid_compatibility_payload";
  }
  if (error instanceof TrustedSourceBottleError) {
    return error.code === "not_found"
      ? "trusted_source_not_found"
      : "trusted_source_invalid";
  }
  return "unexpected_error";
}

const IndependentInputSchema = z
  .object({
    proposal: z.coerce.number(),
    independentBottle: IndependentConcreteBottleCreateRouteInputSchema,
  })
  .strict();

const LegacyInputSchema = z
  .object({
    proposal: z.coerce.number(),
    bottle: BottleInputSchema.optional(),
    release: BottleReleaseInputSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.bottle && !input.release) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bottle"],
        message: "Legacy Bottle or Release creation input is required.",
      });
    }
  });

const OutputSchema = z.object({
  targetId: z.number().int().positive(),
  bottle: BottleSchema,
  release: z.null(),
});

/**
 * Canonical independent approval plus measured translation-only compatibility.
 * Task 9.7 removes the legacy Bottle/Release inputs and response adapter.
 */
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
  .input(z.union([IndependentInputSchema, LegacyInputSchema]))
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    const isIndependent = "independentBottle" in input;
    const payloadShape = isIndependent
      ? null
      : input.bottle && input.release
        ? "combined"
        : input.bottle
          ? "bottle"
          : "release";

    try {
      const actor = await getUserActor(context.user);
      const result = await createBottleFromStorePriceMatchProposal({
        proposalId: input.proposal,
        concreteInput: isIndependent
          ? buildIndependentConcreteBottleCreateInput(input.independentBottle)
          : undefined,
        input: isIndependent ? undefined : input.bottle,
        releaseInput: isIndependent ? undefined : input.release,
        user: context.user,
        actor,
      });

      const bottle = await serialize(
        BottleSerializer,
        result.bottle,
        context.user,
      );
      if (payloadShape) {
        logInfo("Legacy price match create-new compatibility write", {
          extra: {
            event: "price_match_create_new.compatibility",
            access: "write",
            caller: "prices.matchQueue.createBottle",
            operation: "create_concrete_bottle_from_proposal",
            proposalId: input.proposal,
            payloadShape,
            replacementBottleId: result.bottle.id,
            replacementTargetId: result.targetId,
            outcome: "success",
          },
        });
      }

      return {
        targetId: result.targetId,
        bottle,
        release: null,
      };
    } catch (err) {
      if (payloadShape) {
        logInfo("Legacy price match create-new compatibility write", {
          extra: {
            event: "price_match_create_new.compatibility",
            access: "write",
            caller: "prices.matchQueue.createBottle",
            operation: "create_concrete_bottle_from_proposal",
            proposalId: input.proposal,
            payloadShape,
            outcome: "rejected",
            errorClassification: classifyCompatibilityRejection(err),
          },
        });
      }

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
        throw errors.CONFLICT({ message: err.message });
      }

      if (err instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: err.message });
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

      if (err instanceof InvalidPriceMatchConcreteBottleInputError) {
        throw errors.BAD_REQUEST({ message: err.message });
      }

      if (err instanceof TrustedSourceBottleError && err.code === "not_found") {
        throw errors.NOT_FOUND({ message: err.message });
      }

      if (err instanceof TrustedSourceBottleError) {
        throw errors.CONFLICT({ message: err.message });
      }

      throw err;
    }
  });
