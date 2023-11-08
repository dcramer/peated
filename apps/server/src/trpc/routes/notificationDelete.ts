import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    z.object({
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
        code: "NOT_FOUND",
        message: "Notification not found",
      });
    }

    if (notification.userId !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Cannot delete another person's notification",
      });
    }

    await db.delete(notifications).where(eq(notifications.id, notification.id));

    return {};
  });
