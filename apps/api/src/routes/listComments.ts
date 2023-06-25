import { CommentSchema, PaginatedSchema } from "@peated/shared/schemas";
import { and, asc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { db } from "../db";
import { comments } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serialize } from "../lib/serializers";
import { CommentSerializer } from "../lib/serializers/comment";

export default {
  method: "GET",
  url: "/comments",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        user: { oneOf: [{ type: "number" }, { const: "me" }] },
        tasting: { type: "number" },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(CommentSchema),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    // have to specify at least one so folks dont scrape all comments
    if (!req.user?.admin && !req.query.tasting && !req.query.user) {
      return res.send({
        results: [],
        rel: {
          nextPage: null,
          next: null,
          prevPage: null,
          prev: null,
        },
      });
    }

    const where = [];
    if (req.query.user) {
      where.push(
        eq(
          comments.createdById,
          req.query.user === "me" ? req.user.id : req.query.user,
        ),
      );
    }

    if (req.query.tasting) {
      where.push(eq(comments.tastingId, req.query.tasting));
    }

    const results = await db
      .select()
      .from(comments)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(comments.createdAt));

    res.send({
      results: await serialize(
        CommentSerializer,
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
      user?: number | "me";
      tasting?: number;
      page?: number;
    };
  }
>;
