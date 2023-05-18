import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { bottles, tastings } from "../db/schema";
import { shuffle } from "../lib/rand";
import { defaultTags } from "../lib/tags";

export default {
  method: "GET",
  url: "/bottles/:bottleId/suggestedTags",
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
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "count"],
              properties: {
                name: { type: "string" },
                count: { type: "number" },
              },
            },
          },
          rel: {
            type: "object",
            $ref: "/schemas/paging",
          },
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

    const usedTags = Object.fromEntries(
      (
        await db.execute(
          sql<{ name: string; count: string }>`SELECT name, COUNT(name) as count
        FROM (
          SELECT unnest(${tastings.tags}) as name
          FROM ${tastings}
          JOIN ${bottles} ON ${bottles.id} = ${tastings.bottleId}
          WHERE ${tastings.bottleId} = ${bottle.id} OR ${bottles.brandId} = ${bottle.brandId}
        ) as t
        GROUP BY name
        ORDER BY count DESC
        LIMIT 100`,
        )
      ).rows.map((t) => [t.name, parseInt(t.count as string, 10)]),
    );

    const results = shuffle(defaultTags)
      .map((t) => ({
        name: t,
        count: usedTags[t] || 0,
      }))
      .sort((a, b) => {
        const delta = b.count - a.count;
        if (delta == 0) if (a.count < b.count) return a.count;
      });

    res.send({
      results,
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
