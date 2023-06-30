import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { StorePriceInputSchema } from "@peated/shared/schemas";

import { eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import {
  bottles,
  storePriceHistories,
  storePrices,
  stores,
} from "../db/schema";
import { requireAdmin } from "../middleware/auth";

export async function findBottle(name: string): Promise<{ id: number } | null> {
  let bottle: { id: number } | null | undefined;

  // exact match
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, name))
    .limit(1);
  if (bottle) return bottle;

  // match the store's listing as a prefix
  // name: Aberfeldy 18-year-old Single Malt Scotch Whisky
  // bottle.fullName: Aberfeldy 18-year-old
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(sql`${name} ILIKE '%' || ${bottles.fullName} || '%'`)
    .orderBy(bottles.fullName)
    .limit(1);
  if (bottle) return bottle;

  // match our names are prefix as a last resort (this isnt often correct)
  // name: Aberfeldy 18-year-old
  // bottle.fullName: Aberfeldy 18-year-old Super Series
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, `${name} %`))
    .orderBy(bottles.fullName)
    .limit(1);

  return bottle;
}

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
      const bottle = await findBottle(sp.name);
      await db.transaction(async (tx) => {
        // XXX: maybe we should constrain on URL?
        const [{ priceId }] = await tx
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
          })
          .returning({ priceId: storePrices.id });

        await tx
          .insert(storePriceHistories)
          .values({
            priceId: priceId,
            price: sp.price,
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
