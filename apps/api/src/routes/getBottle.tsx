import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { bottles, bottlesToDistillers, entities, tastings } from "../db/schema";
import { db } from "../lib/db";
import { eq, sql } from "drizzle-orm";

export default {
  method: "GET",
  url: "/bottles/:bottleId",
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
    const [{ bottle, brand }] = await db
      .select({
        bottle: bottles,
        brand: entities,
      })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, req.params.bottleId));

    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const distillers = await db
      .select()
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id)
      )
      .where(eq(bottlesToDistillers.bottleId, bottle.id));

    const [{ count: totalTastings }] = await db
      .select({
        count: sql`COUNT(${tastings.bottleId})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    const [{ count: totalPeople, avgRating }] = await db
      .select({
        count: sql`COUNT(DISTINCT ${tastings.createdById})`,
        avgRating: sql`AVG(${tastings.rating})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    res.send({
      ...bottle,
      brand,
      distillers,
      stats: {
        tastings: totalTastings,
        avgRating: avgRating,
        people: totalPeople,
      },
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
