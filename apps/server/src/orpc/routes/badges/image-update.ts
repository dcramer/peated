import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/badges/{badge}/image",
    operationId: "updateBadgeImage",
    summary: "Update badge image",
    description:
      "Upload and update the image for a badge with automatic compression and resizing. Requires admin privileges",
  })
  .input(
    z.object({
      badge: z.coerce.number(),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      imageUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { badge: badgeId, file } = input;

    const [targetBadge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (!targetBadge) {
      throw errors.NOT_FOUND({
        message: "Badge not found.",
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
          filename: "badge-image.jpg",
          file: fileStream,
        },
        namespace: `badges`,
        urlPrefix: "/uploads",
        onProcess: (...args) => compressAndResizeImage(...args, 500, 500),
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

    await db
      .update(badges)
      .set({
        imageUrl,
      })
      .where(eq(badges.id, targetBadge.id));

    return {
      imageUrl: absoluteUrl(config.API_SERVER, imageUrl),
    };
  });
