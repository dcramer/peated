import { CollectionBottleInputSchema } from "@peated/shared/schemas";
import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles, collectionBottles, collections } from "../db/schema";
import { getDefaultCollection } from "../lib/db";
import { sha1 } from "../lib/hash";
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
    body: zodToJsonSchema(CollectionBottleInputSchema),
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

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.body.bottle));
    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const vintageFingerprint = sha1(
      req.body.series,
      req.body.vintageYear,
      req.body.barrel,
    );

    await db.transaction(async (tx) => {
      const [cb] = await tx
        .insert(collectionBottles)
        .values({
          collectionId: collection.id,
          bottleId: bottle.id,
          vintageFingerprint,
          series: req.body.series,
          vintageYear: req.body.vintageYear,
          barrel: req.body.barrel,
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
      collectionId: number | "default";
    };
    Body: z.infer<typeof CollectionBottleInputSchema>;
  }
>;
