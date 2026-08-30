import {
  EntityImageForbiddenError,
  EntityImageNotFoundError,
  updateEntityImage,
} from "@peated/server/lib/entityImages";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  EntityImageCaptionSchema,
  EntityImageSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityImageSerializer } from "@peated/server/serializers/entityImage";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PATCH",
    path: "/entities/{entity}/images/{image}",
    summary: "Update entity image",
    description:
      "Update an image caption or make the image primary. Requires the Entity creator, a moderator, or an administrator.",
    operationId: "updateEntityImage",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      image: z.coerce.number(),
      caption: EntityImageCaptionSchema.removeDefault().optional(),
      makePrimary: z.literal(true).optional(),
    }),
  )
  .output(EntityImageSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const image = await updateEntityImage({
        entityId: input.entity,
        imageId: input.image,
        caption: input.caption,
        makePrimary: input.makePrimary,
        user: context.user,
      });
      return await serialize(EntityImageSerializer, image, context.user);
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
