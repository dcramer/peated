import { DEFAULT_TAGS } from "@peated/shared/constants";
import { db } from "@peated/shared/db";
import { bottleTags, bottles } from "@peated/shared/db/schema";
import { desc, eq, or, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { shuffle } from "../lib/rand";

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
      200: zodToJsonSchema(
        z.object({
          results: z.array(
            z.object({
              tag: z.string(),
              count: z.number(),
            }),
          ),
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

    // TODO: change the logic to be weighted:
    // 1. high: recorded for this bottle (e.g. Hibiki 12-year-old)
    // 2. medium: recorded for this brand (e.g. Hibiki)
    // 3. low: recorded for this category (e.g. bourbon)
    const usedTags = Object.fromEntries(
      (
        await db
          .select({
            tag: bottleTags.tag,
            total: sql<number>`SUM(${bottleTags.count})`.as("total"),
          })
          .from(bottleTags)
          .innerJoin(bottles, eq(bottles.id, bottleTags.bottleId))
          .where(
            or(
              eq(bottleTags.bottleId, bottle.id),
              eq(bottles.brandId, bottle.brandId),
            ),
          )
          .groupBy(bottleTags.tag)
          .orderBy(desc(sql`total`))
      ).map((t) => [t.tag, t.total]),
    );

    const results = shuffle([...DEFAULT_TAGS])
      .map((t) => ({
        tag: t,
        count: usedTags[t] || 0,
      }))
      .sort((a, b) => b.count - a.count);

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
