import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/users/{user}/avatar",
    summary: "Update user avatar",
    description:
      "Upload and update a user's avatar image with automatic compression and resizing. Requires authentication and ownership or admin privileges",
    operationId: "updateUserAvatar",
  })
  .input(
    z.object({
      user: z.union([z.coerce.number(), z.literal("me")]),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      pictureUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const targetUserId = input.user === "me" ? context.user.id : input.user;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (targetUser.id !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "Cannot update another user's avatar.",
      });
    }

    let pictureUrl: string;
    try {
      const arrayBuffer = await input.file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileStream = Readable.from(buffer);

      pictureUrl = await storeFile({
        data: {
          file: fileStream,
        },
        namespace: `avatars`,
        urlPrefix: "/uploads",
        onProcess: (...args) => compressAndResizeImage(...args, 500, 500),
      });
    } catch (err) {
      // Check for file size limits
      if (input.file.size > MAX_FILESIZE) {
        const errMessage = `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`;
        throw errors.PAYLOAD_TOO_LARGE({
          message: errMessage,
          cause: err,
        });
      }
      throw err;
    }

    await db
      .update(users)
      .set({ pictureUrl })
      .where(eq(users.id, targetUser.id));

    return {
      pictureUrl: absoluteUrl(config.API_SERVER, pictureUrl),
    };
  });
