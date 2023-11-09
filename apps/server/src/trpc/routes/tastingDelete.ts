import { db } from "@peated/server/db";
import {
  bottleTags,
  bottles,
  notifications,
  tastings,
  toasts,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure.input(z.number()).mutation(async function ({
  input,
  ctx,
}) {
  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, input))
    .limit(1);
  if (!tasting) {
    throw new TRPCError({
      message: "Tasting not found.",
      code: "NOT_FOUND",
    });
  }

  if (tasting.createdById !== ctx.user.id && !ctx.user.admin) {
    throw new TRPCError({
      message: "Cannot delete another user's tasting.",
      code: "FORBIDDEN",
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(notifications)
      .where(
        and(
          eq(notifications.type, "toast"),
          inArray(
            notifications.objectId,
            sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${tasting.id})`,
          ),
        ),
      );

    await tx.delete(toasts).where(eq(toasts.tastingId, tasting.id));
    await tx.delete(tastings).where(eq(tastings.id, tasting.id));

    // update aggregates after tasting row is removed
    for (const tag of tasting.tags) {
      await tx
        .update(bottleTags)
        .set({
          count: sql`${bottleTags.count} - 1`,
        })
        .where(
          and(
            eq(bottleTags.bottleId, tasting.bottleId),
            eq(bottleTags.tag, tag),
          ),
        );
    }

    await tx
      .update(bottles)
      .set({
        totalTastings: sql`${bottles.totalTastings} - 1`,
        avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId})`,
      })
      .where(eq(bottles.id, tasting.bottleId));

    // TODO: update badge qualifiers
    // TODO: update entities.totalTastings
  });

  return {};
});
