import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { bottles, entities } from "../db/schema";
import { db } from "../lib/db";
import { eq, sql } from "drizzle-orm";

export default {
  method: "GET",
  url: "/entities/:entityId",
  schema: {
    params: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, req.params.entityId));
    if (!entity) {
      return res.status(404).send({ error: "Not found" });
    }

    const [{ count: totalBottles }] = await db
      .select({
        count: sql`COUNT(${bottles.brandId})`,
      })
      .from(bottles)
      .where(eq(bottles.brandId, entity.id));

    res.send({
      ...entity,
      stats: {
        bottles: totalBottles,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      entityId: number;
    };
  }
>;
