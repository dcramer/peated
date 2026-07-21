import {
  BottleGroupPresentationGraphError,
  BottleGroupPresentationInputError,
  BottleGroupPresentationPatchSchema,
  updateBottleGroupPresentation,
} from "@peated/server/lib/updateBottleGroupPresentation";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = BottleGroupPresentationPatchSchema.extend({
  group: z.coerce.number().int().positive(),
}).strict();

const OutputSchema = z.object({ changed: z.boolean() }).strict();

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-groups/{group}/presentation",
    summary: "Update BottleGroup presentation",
    description:
      "Update group-owned editorial presentation without changing member Bottle identity",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleGroupPresentation",
    }),
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { changed } = await updateBottleGroupPresentation({
        groupId: input.group,
        input: {
          representativeBottleId: input.representativeBottleId,
          description: input.description,
          descriptionSrc: input.descriptionSrc,
          imageUrl: input.imageUrl,
          tastingNotes: input.tastingNotes,
        },
        context,
      });
      return { changed };
    } catch (error) {
      if (error instanceof BottleGroupPresentationInputError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (
        error instanceof BottleGroupPresentationGraphError &&
        (error.code === "not_found" ||
          error.code === "representative_not_found")
      ) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof BottleGroupPresentationGraphError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
