import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles } from "../db/schema";

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

    const totalCount = results.reduce((acc, row) => acc + row.count, 0);

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
