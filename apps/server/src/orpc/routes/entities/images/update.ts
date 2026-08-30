import {
  EntityImageNotFoundError,
  updateEntityImage,
} from "@peated/server/lib/entityImages";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityImageCaptionSchema,
  EntityImageSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityImageSerializer } from "@peated/server/serializers/entityImage";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/entities/{entity}/images/{image}",
    summary: "Update entity image",
    description:
      "Update an image caption or make the image primary. Requires a moderator or administrator.",
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
      throw error;
    }
  });
