import {
  ConcreteBottleMergeConflictError,
  ConcreteBottleMergeGraphError,
  ConcreteBottleMergeInputError,
  mergeConcreteBottles,
} from "@peated/server/lib/mergeConcreteBottles";
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
    path: "/bottles/{bottle}/merge",
    summary: "Merge bottles",
    description:
      "Merge two bottles together, combining their data and references. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "mergeBottle",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    const sourceBottleId =
      input.direction === "mergeInto" ? input.bottle : input.other;
    const destinationBottleId =
      input.direction === "mergeInto" ? input.other : input.bottle;

    try {
      const result = await mergeConcreteBottles({
        sourceBottleId,
        destinationBottleId,
        context,
      });
      return await serialize(
        BottleSerializer,
        result.destinationBottle,
        context.user,
      );
    } catch (error) {
      if (
        error instanceof ConcreteBottleMergeInputError ||
        (error instanceof ConcreteBottleMergeConflictError &&
          error.code === "same_bottle")
      ) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (
        error instanceof ConcreteBottleMergeGraphError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (
        error instanceof ConcreteBottleMergeGraphError ||
        error instanceof ConcreteBottleMergeConflictError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
