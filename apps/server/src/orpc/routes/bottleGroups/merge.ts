import {
  BottleGroupMergeConflictError,
  BottleGroupMergeGraphError,
  BottleGroupMergeInputError,
  mergeBottleGroups,
} from "@peated/server/lib/mergeBottleGroups";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = z
  .object({
    group: z.coerce.number().int().positive(),
    destinationGroupId: z.number().int().positive(),
  })
  .strict();

const OutputSchema = z
  .object({
    sourceGroupId: z.number().int().positive(),
    destinationGroupId: z.number().int().positive(),
    changed: z.boolean(),
    movedBottleIds: z.array(z.number().int().positive()),
  })
  .strict();

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-groups/{group}/merge-targets",
    summary: "Merge BottleGroups",
    description:
      "Move every source Bottle into the destination group and retire the source group",
    spec: (spec) => ({
      ...spec,
      operationId: "mergeBottleGroup",
    }),
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return await mergeBottleGroups({
        sourceGroupId: input.group,
        destinationGroupId: input.destinationGroupId,
        context,
      });
    } catch (error) {
      if (
        error instanceof BottleGroupMergeInputError ||
        (error instanceof BottleGroupMergeConflictError &&
          error.code === "same_group")
      ) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (
        error instanceof BottleGroupMergeGraphError &&
        error.code === "not_found"
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (
        error instanceof BottleGroupMergeGraphError ||
        error instanceof BottleGroupMergeConflictError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
