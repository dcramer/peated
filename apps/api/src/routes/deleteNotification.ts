import { db } from "@peated/core/db";
import { notifications } from "@peated/core/db/schema";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { requireAuth } from "../middleware/auth";

export default {
  method: "DELETE",
  url: "/notifications/:notificationId",
  schema: {
    params: {
      type: "object",
      required: ["notificationId"],
      properties: {
        notificationId: { type: "number" },
      },
    },
    response: {
      204: {
        type: "null",
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401).send({ error: "Unauthorized" });

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, req.params.notificationId));

    if (!notification) {
      return res.status(404).send({ error: "Not found" });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).send({ error: "Forbidden" });
    }

    await db.delete(notifications).where(eq(notifications.id, notification.id));

    res.status(204).send();
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      notificationId: number;
    };
  }
>;
