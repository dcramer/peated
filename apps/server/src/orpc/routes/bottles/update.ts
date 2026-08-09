import { BottleUpdateInputSchema } from "@peated/server/lib/bottleSchemas";
import {
  BottleUpdateConflictError,
  BottleUpdateGraphError,
  BottleUpdateInputError,
  updateBottle,
} from "@peated/server/lib/updateBottle";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { z } from "zod";

const InputSchema = BottleUpdateInputSchema.extend({
  bottle: z.coerce.number().int().positive(),
}).strict();

/**
 * Strict moderator HTTP adapter that delegates every shared or exact mutation
 * to the canonical Bottle service and returns the updated Bottle.
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
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await updateBottle({
        bottleId: input.bottle,
        input: { shared: input.shared, exact: input.exact },
        context,
      });

      return await serialize(
        BottleSerializer,
        result.bottle,
        context.user,
        [],
        { includeGroupSummary: true },
      );
    } catch (error) {
      if (error instanceof BottleUpdateInputError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }

      if (
        error instanceof BottleUpdateGraphError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }

      if (error instanceof BottleUpdateGraphError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }

      if (error instanceof BottleUpdateConflictError) {
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
