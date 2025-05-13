import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .route({ method: "POST", path: "/tastings/:id/toast" })
  .input(
    z.object({
      id: z.coerce.number(),
    }),
  )
  .output(z.object({}))
  .use(requireAuth)
  .handler(async function ({ input, context }) {
    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) => eq(tastings.id, input.id),
    });

    if (!tasting) {
      throw new ORPCError("NOT_FOUND", {
        message: "Tasting not found.",
      });
    }

    if (context.user.id === tasting.createdById) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot toast your own tasting.",
      });
    }

    const user = context.user;
    await db.transaction(async (tx) => {
      const [toast] = await tx
        .insert(toasts)
        .values({
          createdById: user.id,
          tastingId: tasting.id,
        })
        .onConflictDoNothing()
        .returning();

      if (toast) {
        await tx
          .update(tastings)
          .set({ toasts: sql`${tastings.toasts} + 1` })
          .where(eq(tastings.id, tasting.id));

        createNotification(tx, {
          fromUserId: toast.createdById,
          type: "toast",
          objectId: toast.id,
          createdAt: toast.createdAt,
          userId: tasting.createdById,
        });
      }
    });

    return {};
  });
