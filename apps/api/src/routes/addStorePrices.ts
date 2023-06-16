import { StorePriceInputSchema } from "@peated/shared/schemas";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { bottles, storePrices, stores } from "../db/schema";
import { requireAdmin } from "../middleware/auth";

export default {
  method: "POST",
  url: "/stores/:storeId/prices",
  schema: {
    params: {
      type: "object",
      required: ["storeId"],
      properties: {
        userId: { type: "number" },
      },
    },
    body: zodToJsonSchema(z.array(StorePriceInputSchema)),
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, req.params.storeId),
    });

    if (!store) {
      return res.status(404).send({ error: "Not found" });
    }

    for (const sp of req.body) {
      const [bottle] = await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(ilike(bottles.fullName, sp.name))
        .limit(1);
      await db
        .insert(storePrices)
        .values({
          bottleId: bottle ? bottle.id : null,
          storeId: store.id,
          name: sp.name,
          price: sp.price,
          url: sp.url,
        })
        .onConflictDoUpdate({
          target: [storePrices.storeId, storePrices.name],
          set: {
            bottleId: bottle ? bottle.id : null,
            price: sp.price,
            url: sp.url,
            updatedAt: sql`NOW()`,
          },
        });
    }

    db.update(stores)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(stores.id, store.id));

    res.status(201).send({});
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      storeId: number;
    };
    Body: z.infer<typeof StorePriceInputSchema>[];
  }
>;
