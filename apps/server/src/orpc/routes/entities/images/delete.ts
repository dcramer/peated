import {
  deleteEntityImage,
  EntityImageForbiddenError,
  EntityImageNotFoundError,
} from "@peated/server/lib/entityImages";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/entities/{entity}/images/{image}",
    summary: "Delete entity image",
    description:
      "Remove an image from an Entity. Another image becomes primary when needed. Requires the Entity creator, a moderator, or an administrator.",
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
      if (error instanceof EntityImageForbiddenError) {
        throw errors.FORBIDDEN({ message: error.message, cause: error });
      }
      throw error;
    }
  });
