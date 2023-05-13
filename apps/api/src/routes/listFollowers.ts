import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { follows, users } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeFollow } from "../lib/transformers/follow";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/users/:userId/followers",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { oneOf: [{ type: "number" }, { const: "me" }] },
      },
    },
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
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;

    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id && !user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    const page = req.query.page || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const where = [eq(follows.toUserId, user.id)];
    if (req.query.status) {
      where.push(eq(follows.status, req.query.status));
    }

    const followsBack = alias(follows, "follows_back");
    const results = await db
      .select({
        user: users,
        follow: follows,
        followsBack: followsBack,
      })
      .from(follows)
      .where(and(...where))
      .innerJoin(users, eq(users.id, follows.fromUserId))
      .leftJoin(followsBack, eq(users.id, followsBack.toUserId))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(follows.status), asc(follows.createdAt));

    res.send({
      results: results.slice(0, limit).map(({ user, follow, followsBack }) =>
        serializeFollow({
          ...follow,
          followsBack,
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
    Params: {
      userId: number | "me";
    };
    Querystring: {
      page?: number;
      status?: "pending" | "following";
    };
  }
>;
