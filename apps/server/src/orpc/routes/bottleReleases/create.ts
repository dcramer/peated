import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import {
  createConcreteBottle,
  TrustedSourceBottleError,
} from "@peated/server/lib/createConcreteBottle";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import loadExactTarget from "@peated/server/orpc/routes/bottles/load-exact-target";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";
import { BottleReleaseInputSchema } from "@peated/server/schemas/bottleReleases";
import { z, ZodError } from "zod";

/**
 * Measured translation-only compatibility over canonical concrete creation.
 * Tasks 9.4 and 9.7 disable and then remove this legacy write surface.
 */
export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottle-releases",
    summary: "Create bottle bottling",
    description:
      "Create a new bottling with specific edition, vintage, and cask details. Requires authentication",
    spec: (spec) => ({
      ...spec,
      operationId: "createBottleRelease",
    }),
  })
  .input(
    BottleReleaseInputSchema.extend({
      bottle: z.coerce.number(),
    }),
  )
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, context, errors }) {
    if (input.imageUrl !== null) {
      throw errors.BAD_REQUEST({
        message:
          "BottleRelease imageUrl is not supported by concrete Bottle creation.",
      });
    }

    try {
      const result = await createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: input.bottle,
          exact: {
            edition: input.edition,
            statedAge: input.statedAge,
            abv: input.abv,
            singleCask: input.singleCask,
            caskStrength: input.caskStrength,
            vintageYear: input.vintageYear,
            releaseYear: input.releaseYear,
            caskSize: input.caskSize,
            caskType: input.caskType,
            caskFill: input.caskFill,
            description: input.description,
            tastingNotes: input.tastingNotes,
          },
        },
      });
      logInfo("Legacy BottleRelease compatibility write", {
        extra: {
          event: "bottle_release.compatibility",
          access: "write",
          caller: "bottleReleases.create",
          operation: "create_concrete_bottle_from_source",
          sourceBottleId: input.bottle,
          replacementBottleId: result.bottle.id,
          replacementTargetId: result.exactTarget.id,
        },
      });

      return await loadExactTarget(
        {
          bottleId: result.bottle.id,
          groupId: result.group.id,
          targetId: result.exactTarget.id,
        },
        context,
      );
    } catch (error) {
      if (error instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: error.message,
          data: { bottle: error.bottleId },
          cause: error,
        });
      }

      if (error instanceof BottleCreateBadRequestError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }

      if (
        error instanceof TrustedSourceBottleError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }

      if (error instanceof TrustedSourceBottleError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }

      if (error instanceof ZodError) {
        throw errors.BAD_REQUEST({
          message: "Invalid concrete Bottle fields.",
          cause: error,
        });
      }

      throw error;
    }
  });
