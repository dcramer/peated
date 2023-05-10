import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import config from "../config";
import { tastings } from "../db/schema";
import { db } from "../lib/db";
import { storeFile } from "../lib/uploads";
import { validateRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

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
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
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
      return res.status(400).send({ error: "Bad request" });
    }

    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request" });
    }

    const imageUrl = await storeFile({
      data: fileData,
      namespace: `tastings`,
      urlPrefix: "/uploads",
    });

    if (fileData.file.truncated) {
      // TODO: delete the file
      return res.status(413).send({
        code: "FST_FILES_LIMIT",
        error: "Payload Too Large",
        message: "reach files limit",
      });
    }

    await db
      .update(tastings)
      .set({
        imageUrl,
      })
      .where(eq(tastings.id, tasting.id));

    res.send({
      imageUrl: imageUrl ? `${config.URL_PREFIX}${imageUrl}` : null,
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
