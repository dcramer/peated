import { ConcreteBottleUpdateInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  ConcreteBottleUpdateConflictError,
  ConcreteBottleUpdateGraphError,
  ConcreteBottleUpdateInputError,
  updateConcreteBottle,
} from "@peated/server/lib/updateConcreteBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";
import { z } from "zod";
import loadExactTarget from "./load-exact-target";

const InputSchema = ConcreteBottleUpdateInputSchema.extend({
  bottle: z.coerce.number().int().positive(),
}).strict();

/**
 * Strict moderator HTTP adapter that delegates every shared or exact mutation
 * to the canonical concrete-Bottle service and returns its validated target.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottles/{bottle}",
    summary: "Update bottle",
    description:
      "Update exact Bottle fields or atomically fan shared BottleGroup fields out to every member",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottle",
    }),
  })
  .input(InputSchema)
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await updateConcreteBottle({
        bottleId: input.bottle,
        input: { shared: input.shared, exact: input.exact },
        context,
      });

      return await loadExactTarget(
        { bottleId: result.bottle.id, groupId: result.group.id },
        context,
      );
    } catch (error) {
      if (error instanceof ConcreteBottleUpdateInputError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }

      if (
        error instanceof ConcreteBottleUpdateGraphError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }

      if (error instanceof ConcreteBottleUpdateGraphError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }

      if (error instanceof ConcreteBottleUpdateConflictError) {
        throw errors.CONFLICT({
          message: error.message,
          data:
            error.conflictingBottleId === null
              ? undefined
              : { bottle: error.conflictingBottleId },
          cause: error,
        });
      }

      throw error;
    }
  });
