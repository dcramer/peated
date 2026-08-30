import {
  deleteEntityImage,
  EntityImageNotFoundError,
} from "@peated/server/lib/entityImages";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/images/{image}",
    summary: "Delete entity image",
    description:
      "Remove an image from an Entity. Another image becomes primary when needed. Requires a moderator or administrator.",
    operationId: "deleteEntityImage",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      image: z.coerce.number(),
    }),
  )
  .output(z.object({}))
  .handler(async ({ input, context, errors }) => {
    try {
      await deleteEntityImage({
        entityId: input.entity,
        imageId: input.image,
        user: context.user,
      });
      return {};
    } catch (error) {
      if (error instanceof EntityImageNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }
  });
