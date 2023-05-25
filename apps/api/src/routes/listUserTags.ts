import { sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { tastings } from "../db/schema";
import { getUserFromId } from "../lib/api";

export default {
  method: "GET",
  url: "/users/:userId/tags",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: {
          anyOf: [{ type: "number" }, { type: "string" }, { const: "me" }],
        },
      },
    },
    response: {
      200: zodToJsonSchema(
        z.object({
          results: z.array(
            z.object({
              tag: z.string(),
              count: z.number(),
            }),
          ),
          totalCount: z.number(),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const user = await getUserFromId(db, req.params.userId, req.user);
    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    const results = await db.execute(
      sql<{ tag: string; count: number }>`SELECT tag, COUNT(tag) as count
    FROM (
      SELECT unnest(${tastings.tags}) as tag
      FROM ${tastings}
      WHERE ${tastings.createdById} = ${user.id}
    ) as t
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 25`,
    );

    const totalCount = (
      await db.execute(
        sql<{ count: number }>`SELECT COUNT(*) as count
    FROM (
      SELECT unnest(${tastings.tags}) as tag
      FROM ${tastings}
      WHERE ${tastings.createdById} = ${user.id}
    ) as t`,
      )
    ).rows[0].count;

    res.send({
      results: results.rows,
      totalCount,
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | string | "me";
    };
  }
>;
