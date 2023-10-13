import { db } from "@peated/shared/db";
import { bottles, tastings } from "@peated/shared/db/schema";
import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export default {
  method: "GET",
  url: "/bottles/:bottleId/tags",
  schema: {
    params: {
      type: "object",
      required: ["bottleId"],
      properties: {
        bottleId: { type: "number" },
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
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, req.params.bottleId));

    if (!bottle) {
      return res.status(404).send({ error: "Not found" });
    }

    const results = await db.query.bottleTags.findMany({
      where: (bottleTags, { eq }) => eq(bottleTags.bottleId, bottle.id),
      orderBy: (bottleTags, { desc }) => desc(bottleTags.count),
      limit: 25,
    });

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const totalCount = (
      await db.execute(
        sql<{ count: number }>`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.bottleId} = ${bottle.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
      )
    ).rows[0].count;

    res.send({
      results,
      totalCount,
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
