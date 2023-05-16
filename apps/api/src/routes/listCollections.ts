import { and, asc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { collections } from "../db/schema";
import { buildPageLink } from "../lib/paging";
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
      results: results.slice(0, limit).map((collection) => ({
        id: collection.id,
        name: collection.name,
      })),
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
