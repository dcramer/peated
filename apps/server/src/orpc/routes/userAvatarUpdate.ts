import { ORPCError } from "@orpc/server";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "POST", path: "/users/:userId/avatar" })
  .input(
    z.object({
      userId: z.union([z.coerce.number(), z.literal("me")]),
      file: z.instanceof(Blob),
    }),
  )
  .output(
    z.object({
      pictureUrl: z.string(),
    }),
  )
  .handler(async function ({ input, context }) {
    const { userId, file } = input;

    const targetUserId = userId === "me" ? context.user.id : userId;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!user) {
      throw new ORPCError("NOT_FOUND", {
        message: "User not found",
      });
    }

    if (user.id !== context.user.id && !context.user.admin) {
      throw new ORPCError("FORBIDDEN", {
        message: "You don't have permission to update this user",
      });
    }

    let pictureUrl: string;
    try {
      // Convert Blob to the format expected by storeFile
      const arrayBuffer = await file.arrayBuffer();
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
      if (file.size > MAX_FILESIZE) {
        const errMessage = `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}`;
        throw new ORPCError("PAYLOAD_TOO_LARGE", {
          message: errMessage,
          cause: err,
        });
      }
      throw err;
    }

    await db.update(users).set({ pictureUrl }).where(eq(users.id, user.id));

    return {
      pictureUrl: absoluteUrl(config.API_SERVER, pictureUrl),
    };
  });
