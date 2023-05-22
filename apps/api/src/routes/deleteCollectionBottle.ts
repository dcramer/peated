import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { collectionBottles } from "../db/schema";
import { getDefaultCollection } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/collections/:collectionId/bottles/:bottleId",
  schema: {
    params: {
      type: "object",
      required: ["collectionId", "bottleId"],
      properties: {
        collectionId: { anyOf: [{ type: "number" }, { const: "default" }] },
        bottleId: { type: "number" },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const collection =
      req.params.collectionId === "default"
        ? await getDefaultCollection(db, req.user.id)
        : await db.query.collections.findFirst({
            where: (collections, { eq }) =>
              eq(collections.id, req.params.collectionId as number),
          });

    if (!collection) {
      return res.status(404).send({ error: "Not found" });
    }

    if (req.user.id !== collection.createdById) {
      return res
        .status(400)
        .send({ error: "Cannot modify another persons collection" });
    }

    await db
      .delete(collectionBottles)
      .where(
        and(
          eq(collectionBottles.bottleId, req.params.bottleId),
          eq(collectionBottles.collectionId, collection.id),
        ),
      );

    res.status(204).send({});
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      collectionId: number | "default";
      bottleId: number;
    };
  }
>;
