import { db } from "@peated/server/db";
import type { NewTasting, Tasting } from "@peated/server/db/schema";
import { bottleTags, follows, tastings } from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware/auth";
import { validateTags } from "@peated/server/orpc/validators/tags";
import { TastingSchema, TastingUpdateFields } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { dispatchTastingStatsRecompute } from "./dispatchStatsRecompute";
import { isTastingIdentityConflict } from "./isTastingIdentityConflict";

const InputSchema = z
  .object({
    tasting: z.coerce.number(),
    ...TastingUpdateFields,
  })
  .strict();

type TastingUpdate = Partial<
  Pick<
    NewTasting,
    | "notes"
    | "rating"
    | "servingStyle"
    | "color"
    | "friends"
    | "tags"
    | "imageUrl"
  >
>;

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PATCH",
    path: "/tastings/{tasting}",
    summary: "Update tasting",
    description:
      "Update tasting information including notes, rating, tags, and friends. Only the tasting creator can update",
    operationId: "updateTasting",
  })
  .input(InputSchema)
  .output(TastingSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const tasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) =>
        and(
          eq(tastings.id, input.tasting),
          eq(tastings.createdById, context.user.id),
        ),
    });
    if (!tasting) {
      throw errors.NOT_FOUND({
        message: "Tasting not found.",
      });
    }

    const tastingData: TastingUpdate = {};
    if (input.notes !== undefined && input.notes !== tasting.notes) {
      tastingData.notes = input.notes;
    }
    if (input.rating !== undefined && input.rating !== tasting.rating) {
      tastingData.rating = input.rating;
    }
    if (
      input.servingStyle !== undefined &&
      input.servingStyle !== tasting.servingStyle
    ) {
      tastingData.servingStyle = input.servingStyle;
    }
    if (input.color !== undefined && input.color !== tasting.color) {
      tastingData.color = input.color;
    }
    // TODO: needs tests yet
    if (input.friends && input.friends.length) {
      const friendUserIds = Array.from(new Set(input.friends));
      const matches = friendUserIds.length
        ? await db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.fromUserId, context.user.id),
                eq(follows.status, "following"),
                inArray(follows.toUserId, friendUserIds),
              ),
            )
        : [];
      if (matches.length != friendUserIds.length) {
        throw errors.BAD_REQUEST({
          message: "Friends must all be active relationships.",
        });
      }
      tastingData.friends = input.friends;
    }

    if (
      input.tags &&
      input.tags !== undefined &&
      !arraysEqual(input.tags, tasting.tags)
    ) {
      tastingData.tags = await validateTags(input.tags);
    }

    if (
      input.image === null &&
      (user?.admin || user?.mod || user?.id === tasting.createdById)
    ) {
      tastingData.imageUrl = null;
    }

    const ratingChanged = tastingData.rating !== undefined;
    const updated = await db.transaction(async (tx) => {
      // Mutation and dispatch use the Bottle reference current after locking.
      const [currentTasting] = await tx
        .select()
        .from(tastings)
        .where(
          and(
            eq(tastings.id, tasting.id),
            eq(tastings.createdById, context.user.id),
          ),
        )
        .limit(1)
        .for("update");
      if (!currentTasting) return;

      const needsBottle = ratingChanged || tastingData.tags !== undefined;
      if (needsBottle && currentTasting.bottleId === null) {
        throw errors.CONFLICT({
          message: `Tasting ${currentTasting.id} has no Bottle.`,
        });
      }
      let newTasting: Tasting | undefined;
      try {
        newTasting = Object.values(tastingData).length
          ? (
              await tx
                .update(tastings)
                .set(tastingData)
                .where(eq(tastings.id, currentTasting.id))
                .returning()
            )[0]
          : currentTasting;
      } catch (error) {
        if (error instanceof Error && isTastingIdentityConflict(error)) {
          throw errors.CONFLICT({
            message: "Tasting already exists.",
            cause: error,
          });
        }
        throw error;
      }
      if (!newTasting) return;

      if (tastingData.tags !== undefined) {
        const bottleId = currentTasting.bottleId!;
        for (const tag of currentTasting.tags) {
          await tx
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
            );
        }
        for (const tag of newTasting.tags) {
          await tx
            .insert(bottleTags)
            .values({
              bottleId,
              tag,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [bottleTags.bottleId, bottleTags.tag],
              set: {
                count: sql<string>`${bottleTags.count} + 1`,
              },
            });
        }
      }

      return {
        tasting: newTasting,
        statsBottleId: ratingChanged ? currentTasting.bottleId : null,
      };
    });

    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to update tasting.",
      });
    }
    const { tasting: newTasting, statsBottleId } = updated;

    if (statsBottleId !== null) {
      await dispatchTastingStatsRecompute(newTasting.id, statsBottleId);
    }

    return await serialize(TastingSerializer, newTasting, context.user);
  });
