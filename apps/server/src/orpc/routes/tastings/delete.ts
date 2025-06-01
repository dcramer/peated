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
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "DELETE",
    path: "/tastings/{tasting}",
    summary: "Delete tasting",
    description:
      "Delete a tasting and update related statistics. Only the tasting creator or admin can delete",
  })
  .input(z.object({ tasting: z.coerce.number() }))
  .output(z.object({}))
  .handler(async ({ input, context, errors }) => {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting))
      .limit(1);
    if (!tasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    if (tasting.createdById !== context.user.id && !context.user.admin) {
      throw errors.FORBIDDEN({
        message: "Cannot delete another user's tasting.",
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
                sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${tasting.id})`
              )
            )
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
                gt(bottleTags.count, 0)
              )
            )
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
