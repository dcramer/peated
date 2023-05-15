import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { notifications } from "../db/schema";
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
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, req.params.notificationId));

    if (!notification) {
      return res.status(404).send({ error: "Not found" });
    }

    if (notification.userId !== req.user.id) {
      return res.status(403).send({ error: "Forbidden " });
    }

    await db
      .update(notifications)
      .set({
        read: true,
      })
      .where(eq(notifications.id, notification.id));

    res.status(200).send({});
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
