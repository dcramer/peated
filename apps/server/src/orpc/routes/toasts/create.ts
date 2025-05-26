import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "POST", path: "/tastings/{tasting}/toast" })
  .input(z.object({ tasting: z.coerce.number() }))
  .output(z.object({}))
  .use(requireAuth)
  .handler(async function ({ input, context, errors }) {
    const { tasting: tastingId } = input;

    const [targetTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tastingId))
      .limit(1);

    if (!targetTasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    if (context.user.id === targetTasting.createdById) {
      throw errors.BAD_REQUEST({
        message: "Cannot toast your own tasting.",
      });
    }

    const user = context.user;
    await db.transaction(async (tx) => {
      const [toast] = await tx
        .insert(toasts)
        .values({
          createdById: user.id,
          tastingId: targetTasting.id,
        })
        .onConflictDoNothing()
        .returning();

      if (toast) {
        await tx
          .update(tastings)
          .set({ toasts: sql`${tastings.toasts} + 1` })
          .where(eq(tastings.id, targetTasting.id));

        createNotification(tx, {
          fromUserId: toast.createdById,
          type: "toast",
          objectId: toast.id,
          createdAt: toast.createdAt,
          userId: targetTasting.createdById,
        });
      }
    });

    return {};
  });
