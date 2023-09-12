import { and, eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

import { db } from "../db";
import { bottles, storePriceHistories, storePrices } from "../db/schema";

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
        pricePerMl: sql<string>`ROUND(AVG(${storePriceHistories.price} / ${storePriceHistories.volume})) as price_per_ml`,
      })
      .from(storePriceHistories)
      .innerJoin(storePrices, eq(storePriceHistories.priceId, storePrices.id))
      .where(
        and(
          eq(storePrices.bottleId, bottle.id),
          sql`${storePrices.updatedAt} > NOW() - interval '3 month'`,
        ),
      )
      .groupBy(storePriceHistories.date);

    res.send({
      results: results.map((r) => ({
        date: r.date,
        pricePerMl: parseInt(r.pricePerMl, 10),
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
