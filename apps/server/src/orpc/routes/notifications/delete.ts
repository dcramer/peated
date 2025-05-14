import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { notifications } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "DELETE", path: "/notifications/:id" })
  .input(
    z.object({
      id: z.coerce.number(),
    }),
  )
  .output(z.object({}))
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

    if (notification.userId !== context.user.id && !context.user.admin) {
      throw new ORPCError("FORBIDDEN", {
        message: "Cannot delete another user's notification.",
      });
    }

    await db.delete(notifications).where(eq(notifications.id, notification.id));

    return {};
  });
