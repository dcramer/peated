import { db } from "@peated/core/db";
import { notifications } from "@peated/core/db/schema";
import { serialize } from "@peated/core/serializers";
import { NotificationSerializer } from "@peated/core/serializers/notification";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
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
        filter: { type: "string", enum: ["unread", "all"] },
      },
    },
    response: {
      // TODO: theres an issue w/ the ref type
      // 200: zodToJsonSchema(
      //   PaginatedSchema.extend({
      //     results: z.array(NotificationSchema),
      //   }),
      // ),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

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
      .select()
      .from(notifications)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(notifications.createdAt));

    res.send({
      results: await serialize(
        NotificationSerializer,
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
      filter?: "unread" | "all";
    };
  }
>;
