import { sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { tastings } from "../db/schema";
import { getUserFromId, profileVisible } from "../lib/api";

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

    if (!(await profileVisible(db, user, req.user))) {
      return res.status(400).send({ error: "User's profile is private" });
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
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
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
