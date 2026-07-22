import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottleTags,
  notifications,
  tastingBadgeAwards,
  tastings,
  toasts,
} from "@peated/server/db/schema";
import { resolveCatalogTargetForAssignment } from "@peated/server/lib/catalogTargets";
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
      // Cleanup and dispatch must use the target current after any concurrent backfill.
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

      const targetInput =
        lockedTasting.targetId !== null
          ? { kind: "target" as const, targetId: lockedTasting.targetId }
          : lockedTasting.bottleId !== null
            ? {
                kind: "legacy" as const,
                bottleId: lockedTasting.bottleId,
                releaseId: lockedTasting.releaseId,
                context: {
                  caller: "tastings.delete",
                  operation: "delete",
                },
              }
            : null;
      if (!targetInput) {
        throw errors.CONFLICT({ message: "Tasting has no catalog identity." });
      }
      const target = await resolveCatalogTargetForAssignment(targetInput, tx);
      const targetBottleId = target.bottleId;

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

        ...(targetBottleId === null
          ? []
          : lockedTasting.tags.map((tag) =>
              tx
                .update(bottleTags)
                .set({
                  count: sql`${bottleTags.count} - 1`,
                })
                .where(
                  and(
                    eq(bottleTags.bottleId, targetBottleId),
                    eq(bottleTags.tag, tag),
                    gt(bottleTags.count, 0),
                  ),
                ),
            )),

        lockedTasting.releaseId
          ? tx
              .update(bottleReleases)
              .set({
                totalTastings: sql`${bottleReleases.totalTastings} - 1`,
              })
              .where(eq(bottleReleases.id, lockedTasting.releaseId))
          : undefined,
      ]);

      // TODO: delete the image from storage
      // TODO: update badge qualifiers
      await tx.delete(tastings).where(eq(tastings.id, lockedTasting.id));
      return { tasting: lockedTasting, target };
    });

    await dispatchTastingStatsRecompute(deleted.tasting.id, deleted.target);

    return {};
  });
