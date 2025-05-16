import { ORPCError } from "@orpc/server";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
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
  .route({ method: "POST", path: "/bottles/:bottleId/image" })
  .input(
    z.object({
      bottleId: z.coerce.number(),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      imageUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { bottleId, file } = input;

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleId))
      .limit(1);

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    if (bottle.createdById !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "You don't have permission to update this bottle.",
      });
    }

    // TODO: this is upsampling images...
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
        namespace: `bottles`,
        urlPrefix: "/uploads",
        onProcess: (...args) =>
          compressAndResizeImage(...args, undefined, 1024),
      });
    } catch (err) {
      // Check for file size limits
      if (file.size > MAX_FILESIZE) {
        const errMessage = `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}`;
        throw new ORPCError("PAYLOAD_TOO_LARGE", {
          message: errMessage,
          cause: err,
        });
      }
      throw err;
    }

    await db
      .update(bottles)
      .set({
        imageUrl,
      })
      .where(eq(bottles.id, bottle.id));

    return {
      imageUrl: absoluteUrl(config.API_SERVER, imageUrl),
    };
  });
