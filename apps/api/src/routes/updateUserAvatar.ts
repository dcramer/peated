import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import config from "../config";
import { db } from "../db";
import { users } from "../db/schema";
import { compressAndResizeImage, storeFile } from "../lib/uploads";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/users/:userId/avatar",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { oneOf: [{ type: "number" }, { const: "me" }] },
      },
    },
    response: {
      200: {
        type: "object",
        required: ["pictureUrl"],
        properties: {
          pictureUrl: {
            type: "string",
          },
        },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    if (!req.isMultipart()) {
      return res
        .status(400)
        .send({ error: "Bad request", code: "invalid_content_type" });
    }

    // TODO: Docs suggest to use this error, but where the hell is the import?
    // if (err instanceof RequestFileTooLargeError) {
    //   return res.status(413).send({error "File too large"};)
    // }
    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request", code: "no_file" });
    }

    const pictureUrl = await storeFile({
      data: fileData,
      namespace: `avatars`,
      urlPrefix: "/uploads",
      onProcess: (...args) => compressAndResizeImage(...args, 500, 500),
    });

    if (fileData.file.truncated) {
      // TODO: delete the file
      return res.status(413).send({
        code: "FST_FILES_LIMIT",
        error: "Payload Too Large",
        message: "reach files limit",
      });
    }

    await db.update(users).set({ pictureUrl }).where(eq(users.id, user.id));

    res.send({
      pictureUrl: pictureUrl ? `${config.URL_PREFIX}${pictureUrl}` : null,
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
    };
    Body: {
      picture?: File;
    };
  }
>;
