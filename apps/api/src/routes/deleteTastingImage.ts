import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { tastings } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
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
            anyOf: [
              {
                type: "string",
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
  preHandler: [requireAuth],
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

    await db
      .update(tastings)
      .set({
        imageUrl: null,
      })
      .where(eq(tastings.id, tasting.id));

    res.send({
      imageUrl: null,
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
  }
>;
