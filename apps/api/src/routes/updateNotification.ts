import { db } from "@peated/core/db";
import { notifications } from "@peated/core/db/schema";
import {
  NotificationInputSchema,
  NotificationSchema,
} from "@peated/core/schemas";
import { serialize } from "@peated/core/serializers";
import { NotificationSerializer } from "@peated/core/serializers/notification";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { requireAuth } from "../middleware/auth";

export default {
  method: "PUT",
  url: "/notifications/:notificationId",
  schema: {
    params: {
      type: "object",
      required: ["notificationId"],
      properties: {
        notificationId: { type: "number" },
      },
    },
    body: zodToJsonSchema(NotificationInputSchema.partial()),
    response: {
      200: zodToJsonSchema(NotificationSchema),
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    if (!req.user) return res.status(401);

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

    const body = req.body;
    const data: { [name: string]: any } = {};
    if (body.read !== undefined) {
      data.read = body.read;
    }

    const [newNotification] = await db
      .update(notifications)
      .set(data)
      .where(eq(notifications.id, notification.id))
      .returning();

    res.send(
      await serialize(NotificationSerializer, newNotification, req.user),
    );
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      notificationId: number;
    };
    Body: Partial<z.infer<typeof NotificationInputSchema>>;
  }
>;
