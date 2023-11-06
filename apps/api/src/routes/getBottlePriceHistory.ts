import { and, desc, eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "@peated/core/db";
import {
  bottles,
  storePriceHistories,
  storePrices,
} from "@peated/core/db/schema";

export default {
  method: "GET",
  url: "/bottles/:bottleId/priceHistory",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId));

    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const results = await db
      .select({
        date: storePriceHistories.date,
        avgPrice: sql<string>`ROUND(AVG(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        minPrice: sql<string>`ROUND(MIN(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
        maxPrice: sql<string>`ROUND(MAX(${storePriceHistories.price} / ${storePriceHistories.volume}))`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(
        and(
          eq(storePrices.bottleId, bottle.id),
          sql`${storePrices.updatedAt} > NOW() - interval '1 year'`,
        ),
      )
      .groupBy(storePriceHistories.date)
      .orderBy(desc(storePriceHistories.date));

    res.send({
      results: results.map((r) => ({
        date: r.date,
        avgPrice: parseInt(r.avgPrice, 10),
        minPrice: parseInt(r.minPrice, 10),
        maxPrice: parseInt(r.maxPrice, 10),
      })),
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      bottleId: number;
    };
  }
>;
