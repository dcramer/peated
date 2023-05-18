import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { bottles, tastings } from "../db/schema";
import { serialize } from "../lib/serializers";
import { BottleSerializer } from "../lib/serializers/bottle";

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
    response: {
      200: {
        type: "object",
        allOf: [{ $ref: "/schemas/bottle" }],
        properties: {
          avgRating: { type: "number" },
          tastings: { type: "number" },
          people: { type: "number" },
        },
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

    const [{ count: totalPeople }] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${tastings.createdById})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    const [{ avgRating }] = await db
      .select({
        avgRating: sql<number>`AVG(${tastings.rating})`,
      })
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));

    res.send({
      ...(await serialize(BottleSerializer, bottle, req.user)),
      tastings: bottle.totalTastings,
      avgRating: avgRating,
      people: totalPeople,
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
