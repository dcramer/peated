import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { StorePriceInputSchema } from "@peated/shared/schemas";

import { db } from "@peated/shared/db";
import {
  storePriceHistories,
  storePrices,
  stores,
} from "@peated/shared/db/schema";
import { eq, sql } from "drizzle-orm";
import { findMatchingBottle } from "~/lib/bottleMatcher";
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
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, req.params.storeId),
    });

    if (!store) {
      return res.status(404).send({ error: "Not found" });
    }

    for (const sp of req.body) {
      const bottle = await findMatchingBottle(db, sp.name);
      await db.transaction(async (tx) => {
        // XXX: maybe we should constrain on URL?
        const [{ priceId }] = await tx
          .insert(storePrices)
          .values({
            bottleId: bottle ? bottle.id : null,
            storeId: store.id,
            name: sp.name,
            price: sp.price,
            volume: sp.volume,
            url: sp.url,
          })
          .onConflictDoUpdate({
            target: [storePrices.storeId, storePrices.name, storePrices.volume],
            set: {
              bottleId: bottle ? bottle.id : null,
              price: sp.price,
              url: sp.url,
              volume: sp.volume,
              updatedAt: sql`NOW()`,
            },
          })
          .returning({ priceId: storePrices.id });

        await tx
          .insert(storePriceHistories)
          .values({
            priceId: priceId,
            price: sp.price,
            volume: sp.volume,
            date: sql`CURRENT_DATE`,
          })
          .onConflictDoNothing();
      });
    }

    await db
      .update(stores)
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
