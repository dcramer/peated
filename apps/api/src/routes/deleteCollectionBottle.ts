import { db } from "@peated/shared/db";
import { collectionBottles } from "@peated/shared/db/schema";
import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { getUserFromId } from "../lib/api";
import { getDefaultCollection } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/users/:userId/collections/:collectionId/bottles/:bottleId",
  schema: {
    params: {
      type: "object",
      required: ["collectionId", "bottleId"],
      properties: {
        userId: {
          anyOf: [{ type: "number" }, { type: "string" }, { const: "me" }],
        },
        collectionId: { anyOf: [{ type: "number" }, { const: "default" }] },
        bottleId: { type: "number" },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const user = await getUserFromId(db, req.params.userId, req.user);
    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id) {
      return res
        .status(400)
        .send({ error: "Cannot modify another persons collection" });
    }

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
      userId: number | string | "me";
      collectionId: number | "default";
      bottleId: number;
    };
  }
>;
