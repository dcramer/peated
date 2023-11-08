import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { NotificationInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { NotificationSerializer } from "@peated/server/serializers/notification";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    NotificationInputSchema.partial().extend({
      notification: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, input.notification));

    if (!notification) {
      throw new TRPCError({
        message: "Notifcation not found.",
        code: "NOT_FOUND",
      });
    }

    if (notification.userId !== ctx.user.id) {
      throw new TRPCError({
        message: "Cannot edit another user's notification.",
        code: "FORBIDDEN",
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

    return await serialize(NotificationSerializer, newNotification, ctx.user);
  });
