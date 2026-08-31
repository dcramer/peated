import {
  createEntityImage,
  EntityImageNotFoundError,
  EntityImageTooLargeError,
} from "@peated/server/lib/entityImages";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  EntityImageCaptionSchema,
  EntityImageLicenseSchema,
  EntityImageSchema,
  EntityImageSourceUrlSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntityImageSerializer } from "@peated/server/serializers/entityImage";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/entities/{entity}/images",
    summary: "Add entity image",
    description:
      "Attach an image to an Entity. The first image becomes the primary image. Requires a moderator or administrator.",
    operationId: "createEntityImage",
  })
  .input(
    z.object({
      entity: z.coerce.number(),
      file: z.instanceof(Blob),
      caption: EntityImageCaptionSchema,
      sourceUrl: EntityImageSourceUrlSchema,
      license: EntityImageLicenseSchema,
      isPrimary: z.boolean().default(false),
      idempotencyKey: z.string().trim().min(1).max(128),
    }),
  )
  .output(EntityImageSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const image = await createEntityImage({
        entityId: input.entity,
        file: input.file,
        caption: input.caption,
        sourceUrl: input.sourceUrl,
        license: input.license,
        isPrimary: input.isPrimary,
        idempotencyKey: input.idempotencyKey,
        user: context.user,
      });
      return await serialize(EntityImageSerializer, image, context.user);
    } catch (error) {
      if (error instanceof EntityImageNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof EntityImageTooLargeError) {
        throw errors.PAYLOAD_TOO_LARGE({
          message: error.message,
          cause: error.cause,
        });
      }
      throw error;
    }
  });
