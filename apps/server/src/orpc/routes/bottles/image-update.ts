import {
  BottleImageBottleNotFoundError,
  BottleImageForbiddenError,
  BottleImageTooLargeError,
  updateBottleImageForUser,
} from "@peated/server/lib/updateBottleImage";
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
    method: "POST",
    path: "/bottles/{bottle}/image",
    summary: "Update bottle image",
    description:
      "Upload and update the image for a bottle with automatic compression and resizing. Requires authentication and ownership or admin privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleImage",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      imageUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId, file } = input;
    try {
      return await updateBottleImageForUser({
        bottleId,
        file,
        user: context.user,
      });
    } catch (error) {
      if (error instanceof BottleImageBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof BottleImageForbiddenError) {
        throw errors.FORBIDDEN({ message: error.message, cause: error });
      }
      if (error instanceof BottleImageTooLargeError) {
        throw errors.PAYLOAD_TOO_LARGE({
          message: error.message,
          cause: error.cause,
        });
      }
      throw error;
    }
  });
