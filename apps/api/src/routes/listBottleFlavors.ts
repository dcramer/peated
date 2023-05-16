import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { bottles, tastings } from "../db/schema";

export default {
  method: "GET",
  url: "/bottles/:bottleId/flavors",
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

    const tags = await db.execute(
      sql<
        [string, number]
      >`SELECT name, COUNT(name) as count FROM ${tastings}, unnest(${tastings.tags}) as name WHERE ${tastings.bottleId} = ${bottle.id} GROUP BY name ORDER BY COUNT(name) DESC LIMIT 100`,
    );

    res.send({ results: tags.rows });
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
