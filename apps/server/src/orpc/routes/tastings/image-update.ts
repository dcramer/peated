import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/tastings/{tasting}/image",
    summary: "Update tasting image",
    spec: {
      operationId: "updateTastingImage",
    },
    description:
      "Upload and update the image for a tasting with automatic compression and resizing. Requires authentication and ownership or admin privileges",
  })
  .input(
    z.object({
      tasting: z.coerce.number(),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      imageUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { tasting: tastingId, file } = input;

    const [targetTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tastingId))
      .limit(1);

    if (!targetTasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    if (targetTasting.createdById !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "You don't have permission to update this tasting.",
      });
    }

    let imageUrl: string;
    try {
      // Convert Blob to the format expected by storeFile
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileStream = Readable.from(buffer);

      imageUrl = await storeFile({
        data: {
          file: fileStream,
        },
        namespace: `tastings`,
        urlPrefix: "/uploads",
        onProcess: (...args) =>
          compressAndResizeImage(...args, undefined, 1024),
      });
    } catch (err) {
      // Check for file size limits
      if (file.size > MAX_FILESIZE) {
        const errMessage = `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`;
        throw errors.PAYLOAD_TOO_LARGE({
          message: errMessage,
          cause: err,
        });
      }
      throw err;
    }

    // TODO: handle failure
    await db
      .update(tastings)
      .set({
        imageUrl,
      })
      .where(eq(tastings.id, tastingId));

    return {
      imageUrl: absoluteUrl(config.API_SERVER, imageUrl),
    };
  });
