import { db } from "@peated/server/db";
import {
  bottleTags,
  notifications,
  tastingBadgeAwards,
  tastings,
  toasts,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { dispatchTastingStatsRecompute } from "./dispatchStatsRecompute";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/tastings/{tasting}",
    summary: "Delete tasting",
    description:
      "Delete a tasting and update related statistics. Only the tasting creator or admin can delete",
    operationId: "deleteTasting",
  })
  .input(z.object({ tasting: z.coerce.number() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
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

    const deleted = await db.transaction(async (tx) => {
      // Cleanup and dispatch use the Bottle reference current after locking.
      const [lockedTasting] = await tx
        .select()
        .from(tastings)
        .where(eq(tastings.id, input.tasting))
        .limit(1)
        .for("update");
      if (!lockedTasting) {
        throw errors.NOT_FOUND({
          message: "Tasting not found.",
        });
      }
      if (
        lockedTasting.createdById !== context.user.id &&
        !context.user.admin
      ) {
        throw errors.FORBIDDEN({
          message: "Cannot delete another user's tasting.",
        });
      }

      if (lockedTasting.bottleId === null) {
        throw errors.CONFLICT({
          message: `Tasting ${lockedTasting.id} has no Bottle.`,
        });
      }
      const bottleId = lockedTasting.bottleId;

      await Promise.all([
        tx
          .delete(notifications)
          .where(
            and(
              eq(notifications.type, "toast"),
              inArray(
                notifications.objectId,
                sql`(SELECT ${toasts.id} FROM ${toasts} WHERE ${toasts.tastingId} = ${lockedTasting.id})`,
              ),
            ),
          ),

        tx.delete(toasts).where(eq(toasts.tastingId, lockedTasting.id)),

        tx
          .delete(tastingBadgeAwards)
          .where(eq(tastingBadgeAwards.tastingId, lockedTasting.id)),

        ...lockedTasting.tags.map((tag) =>
          tx
            .update(bottleTags)
            .set({
              count: sql`${bottleTags.count} - 1`,
            })
            .where(
              and(
                eq(bottleTags.bottleId, bottleId),
                eq(bottleTags.tag, tag),
                gt(bottleTags.count, 0),
              ),
            ),
        ),
      ]);

      // TODO: delete the image from storage
      // TODO: update badge qualifiers
      await tx.delete(tastings).where(eq(tastings.id, lockedTasting.id));
      return { tasting: lockedTasting, bottleId };
    });

    await dispatchTastingStatsRecompute(deleted.tasting.id, deleted.bottleId);

    return {};
  });
