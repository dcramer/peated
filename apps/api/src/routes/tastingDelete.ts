import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottleTags,
  bottles,
  notifications,
  tastingBadgeAwards,
  tastings,
  toasts,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "../trpc";

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
    await Promise.all([
      tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, "toast"),
            inArray(
              notifications.objectId,
              sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${tasting.id})`,
            ),
          ),
        ),

      tx.delete(toasts).where(eq(toasts.tastingId, tasting.id)),

      tx
        .delete(tastingBadgeAwards)
        .where(eq(tastingBadgeAwards.tastingId, tasting.id)),

      ...tasting.tags.map((tag) =>
        tx
          .update(bottleTags)
          .set({
            count: sql`${bottleTags.count} - 1`,
          })
          .where(
            and(
              eq(bottleTags.bottleId, tasting.bottleId),
              eq(bottleTags.tag, tag),
              gt(bottleTags.count, 0),
            ),
          ),
      ),

      tx
        .update(bottles)
        .set({
          totalTastings: sql`${bottles.totalTastings} - 1`,
          avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottles.id} = ${tastings.bottleId} AND ${tastings.id} != ${tasting.id})`,
        })
        .where(eq(bottles.id, tasting.bottleId)),

      tasting.releaseId
        ? tx
            .update(bottleReleases)
            .set({
              totalTastings: sql`${bottleReleases.totalTastings} - 1`,
              avgRating: sql`(SELECT AVG(${tastings.rating}) FROM ${tastings} WHERE ${bottleReleases.id} = ${tastings.releaseId})`,
            })
            .where(eq(bottleReleases.id, tasting.releaseId))
        : undefined,
    ]);

    // TODO: delete the image from storage
    // TODO: update badge qualifiers
    // TODO: update entities.totalTastings
    await tx.delete(tastings).where(eq(tastings.id, tasting.id));
  });

  return {};
});
