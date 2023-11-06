import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { CollectionBottleInputSchema } from "@peated/core/schemas";

import { db } from "@peated/core/db";
import {
  bottles,
  collectionBottles,
  collections,
} from "@peated/core/db/schema";
import { getUserFromId } from "../lib/api";
import { getDefaultCollection } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export default {
  method: "POST",
  url: "/users/:userId/collections/:collectionId/bottles",
  schema: {
    params: {
      type: "object",
      required: ["collectionId"],
      properties: {
        userId: {
          anyOf: [{ type: "number" }, { type: "string" }, { const: "me" }],
        },
        collectionId: { anyOf: [{ type: "number" }, { const: "default" }] },
      },
    },
    body: zodToJsonSchema(CollectionBottleInputSchema),
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
        ? await getDefaultCollection(db, user.id)
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

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.body.bottle));
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    await db.transaction(async (tx) => {
      const [cb] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId: bottle.id,
        })
        .onConflictDoNothing()
        .returning();
      if (cb) {
        await tx
          .update(collections)
          .set({
            totalBottles: sql`${collections.totalBottles} + 1`,
          })
          .where(eq(collections.id, collection.id));
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
      userId: number | string | "me";
      collectionId: number | "default";
    };
    Body: z.infer<typeof CollectionBottleInputSchema>;
  }
>;
