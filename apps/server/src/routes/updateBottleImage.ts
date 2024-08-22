import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import config from "../config";
import { compressAndResizeImage, storeFile } from "../lib/uploads";
import { absoluteUrl } from "../lib/urls";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/bottles/:bottleId/image",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
    response: {
      200: {
        type: "object",
        required: ["imageUrl"],
        properties: {
          imageUrl: {
            type: "string",
          },
        },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId))
      .limit(1);
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    if (bottle.createdById !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    if (!req.isMultipart()) {
      return res
        .status(400)
        .send({ error: "Bad request", code: "invalid_content_type" });
    }
    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request", code: "no_file" });
    }

    let imageUrl: string;
    try {
      imageUrl = await storeFile({
        data: fileData,
        namespace: `bottles`,
        urlPrefix: "/uploads",
        onProcess: (...args) =>
          compressAndResizeImage(...args, undefined, 1024),
      });
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

    await db
      .update(bottles)
      .set({
        imageUrl,
      })
      .where(eq(bottles.id, bottle.id));

    res.send({
      imageUrl: absoluteUrl(config.API_SERVER, imageUrl),
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
    Body: {
      image?: File;
    };
  }
>;
