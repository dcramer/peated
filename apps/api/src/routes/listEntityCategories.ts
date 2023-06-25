import { eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { bottles, bottlesToDistillers, entities } from "../db/schema";

export default {
  method: "GET",
  url: "/entities/:entityId/categories",
  schema: {
    params: {
      type: "object",
      required: ["entityId"],
      properties: {
        entityId: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        z.object({
          results: z.array(
            z.object({
              category: z.string(),
              count: z.number(),
            }),
          ),
          totalCount: z.number(),
        }),
      ),
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

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const results = (
      await db.execute(
        sql<{
          count: number;
          category: string | null;
        }>`SELECT COUNT(*) as count, category
              FROM ${bottles}
              WHERE ${bottles.brandId} = ${entity.id}
                 OR ${bottles.bottlerId} = ${entity.id}
                 OR EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.bottleId} = ${bottles.id} AND ${bottlesToDistillers.distillerId} = ${entity.id})
              GROUP BY ${bottles.category}`,
      )
    ).rows;

    res.send({
      results,
      totalCount: entity.totalBottles,
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
