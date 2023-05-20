import { CollectionSchema, PaginatedSchema } from "@peated/shared/schemas";
import { and, asc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { collections } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { CollectionSerializer } from "../lib/serializers/collection";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/collections",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        user: { oneOf: [{ type: "number" }, { const: "me" }] },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(CollectionSchema),
        }),
      ),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const where = [];
    if (req.query.user) {
      where.push(
        eq(
          collections.createdById,
          req.query.user === "me" ? req.user.id : req.query.user,
        ),
      );
    }

    const results = await db
      .select()
      .from(collections)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(collections.name));

    res.send({
      results: await serialize(
        CollectionSerializer,
        results.slice(0, limit),
        req.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prev:
          page > 1
            ? buildPageLink(req.routeOptions.url, req.query, page - 1)
            : null,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      user: number | "me";
      page?: number;
    };
  }
>;
