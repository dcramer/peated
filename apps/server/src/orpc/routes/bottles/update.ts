import { BottlePatchSchema } from "@peated/server/lib/bottleSchemas";
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

const InputSchema = BottlePatchSchema.extend({
  bottle: z.coerce.number().int().positive(),
}).strict();

/**
 * Strict moderator HTTP adapter that delegates each flat Bottle patch to the
 * canonical Bottle service and returns the updated Bottle.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottles/{bottle}",
    summary: "Update bottle",
    description:
      "Update Bottle fields; the server owns shared BottleGroup fan-out",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottle",
    }),
  })
  .input(InputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const { bottle, ...patch } = input;
      const result = await updateBottle({
        bottleId: bottle,
        input: patch,
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
