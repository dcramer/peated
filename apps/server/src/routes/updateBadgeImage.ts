import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { MAX_FILESIZE } from "@peated/server/constants";
import { humanizeBytes } from "@peated/server/lib/strings";

import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import config from "../config";
import { compressAndResizeImage, storeFile } from "../lib/uploads";
import { absoluteUrl } from "../lib/urls";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "POST",
  url: "/badges/:badgeId/image",
  schema: {
    params: {
      type: "object",
      required: ["badgeId"],
      properties: {
        badgeId: { type: "number" },
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
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send();

    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, req.params.badgeId))
      .limit(1);
    if (!badge) {
      return res.status(404).send({ error: "Not found" });
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
        namespace: `badges`,
        urlPrefix: "/uploads",
        onProcess: (...args) => compressAndResizeImage(...args, 500, 500),
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
      .update(badges)
      .set({
        imageUrl,
      })
      .where(eq(badges.id, badge.id));

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
      badgeId: number;
    };
    Body: {
      image?: File;
    };
  }
>;
