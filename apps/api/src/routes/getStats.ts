import { sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles, entities, tastings } from "../db/schema";

export default {
  method: "GET",
  url: "/stats",
  schema: {
    response: {
      200: zodToJsonSchema(
        z.object({
          totalTastings: z.number(),
          totalBottles: z.number(),
          totalEntities: z.number(),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const [{ totalTastings }] = await db
      .select({
        totalTastings: sql`COUNT(${tastings.id})`,
      })
      .from(tastings);

    const [{ totalBottles }] = await db
      .select({
        totalBottles: sql`COUNT(${bottles.id})`,
      })
      .from(bottles);

    const [{ totalEntities }] = await db
      .select({
        totalEntities: sql`COUNT(${entities.id})`,
      })
      .from(entities);

    res.send({
      totalTastings,
      totalBottles,
      totalEntities,
    });
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
