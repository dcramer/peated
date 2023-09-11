import type { SQL } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/countNotifications",
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
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, req.user.id),
    ];
    if (req.query.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(where ? and(...where) : undefined);

    res.send({ count: count });
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
