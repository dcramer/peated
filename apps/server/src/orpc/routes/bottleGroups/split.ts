import {
  BottleGroupSplitConflictError,
  BottleGroupSplitGraphError,
  BottleGroupSplitInputError,
  BottleGroupSplitInputSchema,
  splitBottleGroup,
} from "@peated/server/lib/splitBottleGroup";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = BottleGroupSplitInputSchema.extend({
  group: z.coerce.number().int().positive(),
}).strict();

const OutputSchema = z
  .object({
    sourceGroupId: z.number().int().positive(),
    newGroupId: z.number().int().positive(),
    movedBottleIds: z.array(z.number().int().positive()),
    sourceRepresentativeBottleId: z.number().int().positive(),
    newRepresentativeBottleId: z.number().int().positive(),
  })
  .strict();

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-groups/{group}/split",
    summary: "Split a BottleGroup",
    description:
      "Move selected Bottles into a new group while generic activity stays with the source group",
    spec: (spec) => ({
      ...spec,
      operationId: "splitBottleGroup",
    }),
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return await splitBottleGroup({
        sourceGroupId: input.group,
        input: {
          movedBottleIds: input.movedBottleIds,
          newRepresentativeBottleId: input.newRepresentativeBottleId,
          sourceRepresentativeBottleId: input.sourceRepresentativeBottleId,
        },
        context,
      });
    } catch (error) {
      if (error instanceof BottleGroupSplitInputError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (
        error instanceof BottleGroupSplitGraphError &&
        (error.code === "not_found" || error.code === "moved_bottle_not_found")
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (
        error instanceof BottleGroupSplitGraphError ||
        error instanceof BottleGroupSplitConflictError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
