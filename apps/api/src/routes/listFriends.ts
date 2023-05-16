import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { follows, users } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeFriend } from "../lib/serializers/friend";
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
        status: { type: "string", enum: ["pending", "following"] },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const where = [
      eq(follows.fromUserId, req.user.id),
      ne(follows.status, "none"),
    ];
    if (req.query.status) {
      where.push(eq(follows.status, req.query.status));
    }

    const results = await db
      .select({
        user: users,
        follow: follows,
      })
      .from(follows)
      .where(and(...where))
      .innerJoin(users, eq(users.id, follows.toUserId))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(follows.status), asc(follows.createdAt));

    res.send({
      results: results.slice(0, limit).map(({ user, follow }) =>
        serializeFriend({
          ...follow,
          user,
        }),
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
      status?: "pending" | "following";
    };
  }
>;
