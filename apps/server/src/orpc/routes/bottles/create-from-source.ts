import { SourceBottleConcreteCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import {
  TrustedSourceBottleError,
  createConcreteBottle,
} from "@peated/server/lib/createConcreteBottle";
import { procedure } from "@peated/server/orpc";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";
import loadExactTarget from "./load-exact-target";

/**
 * The path Bottle identifies trusted group context; BottleGroup owns shared
 * edits, the request owns exact fields, and the created Bottle durably stores
 * shared values for independent reads. The response is checked against that
 * graph.
 */
export default procedure
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottles/from/{bottle}",
    summary: "Create bottle from source",
    description:
      "Create another concrete Bottle using an existing Bottle as trusted group context",
    spec: (spec) => ({
      ...spec,
      operationId: "createBottleFromSource",
    }),
  })
  .input(SourceBottleConcreteCreateRouteInputSchema)
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, context, errors }) {
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
            descriptionSrc: input.descriptionSrc,
            tastingNotes: input.tastingNotes,
          },
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

      throw error;
    }
  });
