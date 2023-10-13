import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { StoreInputSchema, StoreSchema } from "@peated/shared/schemas";

import { db } from "@peated/shared/db";
import { stores } from "@peated/shared/db/schema";
import { serialize } from "../lib/serializers";
import { StoreSerializer } from "../lib/serializers/store";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "POST",
  url: "/stores",
  schema: {
    body: zodToJsonSchema(StoreInputSchema),
    response: {
      201: zodToJsonSchema(StoreSchema),
    },
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const body = req.body;

    const store = await db.transaction(async (tx) => {
      try {
        const [store] = await tx.insert(stores).values(body).returning();
        return store;
      } catch (err: any) {
        if (err?.code === "23505" && err?.constraint === "store_type") {
          res
            .status(409)
            .send({ error: "Store with aggregator type already exists" });
          return;
        }
        throw err;
      }
    });

    if (!store) {
      return res.status(500).send({ error: "Failed to create entity" });
    }

    res.status(201).send(await serialize(StoreSerializer, store, req.user));
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: z.infer<typeof StoreInputSchema>;
  }
>;
