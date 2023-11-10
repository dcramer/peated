import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { MAX_FILESIZE } from "@peated/server/constants";
import { humanizeBytes } from "@peated/server/lib/strings";

import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import config from "../config";
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
    if (!req.user) return res.status(401).send();

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

    let pictureUrl: string;
    try {
      pictureUrl = await storeFile({
        data: fileData,
        namespace: `avatars`,
        urlPrefix: "/uploads",
        onProcess: (...args) => compressAndResizeImage(...args, 500, 500),
      });
      console.error("stored");
    } catch (err) {
      if (fileData.file.truncated) {
        // TODO: delete the file
        const errMessage = `File exceeded maximum upload size of ${humanizeBytes(
          MAX_FILESIZE,
        )}`;
        return res.status(413).send({
          code: "FST_FILES_LIMIT",
          error: "Payload Too Large",
          message: errMessage,
        });
      }
      throw err;
    }

    await db.update(users).set({ pictureUrl }).where(eq(users.id, user.id));

    res.send({
      pictureUrl: pictureUrl ? `${config.API_SERVER}${pictureUrl}` : null,
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
