import { eq, inArray } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db, first } from "../db";
import {
  Collection,
  bottles,
  collectionBottles,
  collections,
} from "../db/schema";
import { getDefaultCollection } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/collections/:collectionId/bottles",
  schema: {
    params: {
      type: "object",
      required: ["collectionId"],
      properties: {
        collectionId: { anyOf: [{ type: "number" }, { const: "default" }] },
      },
    },
    body: {
      type: "object",
      required: ["bottle"],
      properties: {
        bottle: {
          anyOf: [
            { type: "number" },
            { type: "array", items: { type: "number" } },
          ],
        },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const collection =
      req.params.collectionId === "default"
        ? await getDefaultCollection(db, req.user.id)
        : first<Collection>(
            await db
              .select()
              .from(collections)
              .where(eq(collections.id, req.params.collectionId)),
          );

    if (!collection) {
      return res.status(404).send({ error: "Not found" });
    }

    if (req.user.id !== collection.createdById) {
      return res
        .status(400)
        .send({ error: "Cannot modify another persons collection" });
    }

    // find bottles
    const bottleIds = Array.from(
      new Set(
        typeof req.body.bottle === "number"
          ? [req.body.bottle]
          : req.body.bottle,
      ),
    );
    const bottleList = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, bottleIds));
    if (bottleList.length !== bottleIds.length) {
      // could error out here
    }

    await db.transaction(async (tx) => {
      for (const bottle of bottleList) {
        await tx.insert(collectionBottles).values({
          collectionId: collection.id,
          bottleId: bottle.id,
        });
      }
    });

    res.status(200).send({});
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      collectionId: number | "default";
    };
    Body: {
      bottle: number | number[];
    };
  }
>;
