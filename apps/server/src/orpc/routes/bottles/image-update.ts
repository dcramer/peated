import {
  BottleImageBottleNotFoundError,
  BottleImageForbiddenError,
  BottleImageNotFoundError,
  BottleImageTooLargeError,
  updateBottleImageForUser,
} from "@peated/server/lib/updateBottleImage";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  BottleImageLicenseSchema,
  BottleImageSourceUrlSchema,
} from "@peated/server/schemas";
import { z } from "zod";

const InputSchema = z
  .object({
    bottle: z.coerce.number(),
    file: z.instanceof(Blob).optional(),
    sourceUrl: BottleImageSourceUrlSchema.unwrap().removeDefault().optional(),
    license: BottleImageLicenseSchema.unwrap().removeDefault().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.file && !("sourceUrl" in input) && !("license" in input)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add an image, source URL, or license.",
      });
    }
  });

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/image",
    summary: "Update bottle image",
    description:
      "Upload a bottle image or update its source and license. Requires authentication and ownership or admin privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleImage",
    }),
  })
  .input(InputSchema)
  .output(
    z.object({
      imageUrl: z.string(),
      sourceUrl: BottleImageSourceUrlSchema,
      license: BottleImageLicenseSchema,
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { bottle: bottleId, file, sourceUrl, license } = input;
    try {
      return await updateBottleImageForUser({
        bottleId,
        file,
        sourceUrl,
        license,
        user: context.user,
      });
    } catch (error) {
      if (error instanceof BottleImageBottleNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof BottleImageNotFoundError) {
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
