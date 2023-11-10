import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, input));

  if (!notification) {
    throw new TRPCError({
      message: "Notification not found.",
      code: "NOT_FOUND",
    });
  }

  if (notification.userId !== ctx.user.id && !ctx.user.admin) {
    throw new TRPCError({
      message: "Cannot delete another user's notification.",
      code: "FORBIDDEN",
    });
  }

  await db.delete(notifications).where(eq(notifications.id, notification.id));

  return {};
});
