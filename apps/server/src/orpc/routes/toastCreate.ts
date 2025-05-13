import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const tasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, input),
  });

  if (!tasting) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tasting not found.",
    });
  }

  if (ctx.user.id === tasting.createdById) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot toast your own tasting.",
    });
  }

  const user = ctx.user;
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
