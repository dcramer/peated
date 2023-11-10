import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { MAX_FILESIZE } from "@peated/server/constants";
import { humanizeBytes } from "@peated/server/lib/strings";

import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import config from "../config";
import { compressAndResizeImage, storeFile } from "../lib/uploads";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/tastings/:tastingId/image",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
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

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, req.params.tastingId))
      .limit(1);
    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    if (tasting.createdById !== req.user.id && !req.user.admin) {
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

    console.error("we here");
    let imageUrl: string;
    try {
      imageUrl = await storeFile({
        data: fileData,
        namespace: `tastings`,
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
      .update(tastings)
      .set({
        imageUrl,
      })
      .where(eq(tastings.id, tasting.id));

    res.send({
      imageUrl: imageUrl ? `${config.API_SERVER}${imageUrl}` : null,
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
    Body: {
      image?: File;
    };
  }
>;
