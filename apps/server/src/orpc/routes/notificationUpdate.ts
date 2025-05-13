import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import {
  NotificationInputSchema,
  NotificationSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { NotificationSerializer } from "@peated/server/serializers/notification";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "PATCH", path: "/notifications/:id" })
  .input(
    NotificationInputSchema.partial().extend({
      id: z.coerce.number(),
    }),
  )
  .output(NotificationSchema)
  .handler(async function ({ input, context }) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, input.id));

    if (!notification) {
      throw new ORPCError("NOT_FOUND", {
        message: "Notification not found.",
      });
    }

    if (notification.userId !== context.user.id) {
      throw new ORPCError("FORBIDDEN", {
        message: "Cannot edit another user's notification.",
      });
    }

    const data: { [name: string]: any } = {};
    if (input.read !== undefined) {
      data.read = input.read;
    }

    const [newNotification] = await db
      .update(notifications)
      .set(data)
      .where(eq(notifications.id, notification.id))
      .returning();

    return await serialize(
      NotificationSerializer,
      newNotification,
      context.user,
    );
  });
