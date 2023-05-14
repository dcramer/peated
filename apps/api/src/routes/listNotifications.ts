import { SQL, and, desc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { notifications, users } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/notifications",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        filter: { type: "string", enum: ["unread"] },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, req.user.id),
    ];
    if (req.query.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const results = await db
      .select({
        notification: notifications,
        fromUser: users,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.fromUserId))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(notifications.createdAt));

    res.send({
      results: results.map(({ fromUser, notification }) => ({
        ...notification,
        fromUser,
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
      page?: number;
      filter?: "unread";
    };
  }
>;
