import { db } from "@peated/core/db";
import { follows } from "@peated/core/db/schema";
import { FriendSchema, PaginatedSchema } from "@peated/core/schemas";
import { serialize } from "@peated/core/serializers";
import { FriendSerializer } from "@peated/core/serializers/friend";
import { and, asc, desc, eq, not } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { buildPageLink } from "../lib/paging";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/friends",
  schema: {
    querystring: {
      type: "object",
      properties: {
        query: { type: "string" },
        page: { type: "number" },
        filter: { type: "string", enum: ["pending", "active"] },
      },
    },
    response: {
      200: zodToJsonSchema(
        PaginatedSchema.extend({
          results: z.array(FriendSchema),
        }),
      ),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const where = [
      eq(follows.fromUserId, req.user.id),
      not(eq(follows.status, "none")),
    ];
    if (req.query.filter === "pending") {
      where.push(eq(follows.status, "pending"));
    } else if (req.query.filter === "active") {
      where.push(eq(follows.status, "following"));
    }

    const results = await db
      .select()
      .from(follows)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(follows.status), asc(follows.createdAt));

    res.send({
      results: await serialize(
        FriendSerializer,
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
      page?: number;
      filter?: "pending" | "active";
    };
  }
>;
