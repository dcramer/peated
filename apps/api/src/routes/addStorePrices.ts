import { BottlePriceInputSchema } from "@peated/shared/schemas";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { bottlePrices, bottles, entities, stores } from "../db/schema";
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
    body: zodToJsonSchema(z.array(BottlePriceInputSchema)),
  },
  preHandler: [requireAdmin],
  handler: async (req, res) => {
    const store = await db.query.stores.findFirst({
      where: eq(stores.id, req.params.storeId),
    });

    if (!store) {
      return res.status(404).send({ error: "Not found" });
    }

    for (const bottlePrice of req.body) {
      const [bottle] = await db
        .select({ id: bottles.id })
        .from(bottles)
        .innerJoin(entities, eq(entities.id, bottles.brandId))
        .where(
          sql<string>`${entities.name} || ' ' || ${bottles.name} = ${bottlePrice.name}`,
        );
      if (!bottle) {
        console.log(`Could not find bottle ${bottlePrice.name}`);
        continue;
      }
      await db.transaction(async (tx) => {
        await tx
          .insert(bottlePrices)
          .values({
            bottleId: bottle.id,
            storeId: store.id,
            price: bottlePrice.price,
            url: bottlePrice.url,
          })
          .onConflictDoUpdate({
            target: [bottlePrices.bottleId, bottlePrices.storeId],
            set: {
              price: bottlePrice.price,
              url: bottlePrice.url,
              createdAt: new Date(),
            },
          })
          .returning();
        return store;
      });
    }

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
    Body: z.infer<typeof BottlePriceInputSchema>[];
  }
>;
