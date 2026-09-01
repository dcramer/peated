import { db } from "@peated/server/db";
import { follows, memberReviews } from "@peated/server/db/schema";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToMemberReview,
  getUsablePendingUpload,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { validateTags } from "@peated/server/orpc/validators/tags";
import {
  MemberReviewInputSchema,
  MemberReviewSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "PUT",
    path: "/bottles/{bottle}/member-review",
    summary: "Save my member review",
    operationId: "saveMemberReview",
  })
  .input(
    MemberReviewInputSchema.extend({
      bottle: z.coerce.number().int().positive(),
      pendingImageId: z.string().trim().min(1).optional(),
    }),
  )
  .output(MemberReviewSchema)
  .handler(async ({ input, context, errors }) => {
    if (input.pendingImageId) {
      try {
        const pendingUpload = await getUsablePendingUpload({
          id: input.pendingImageId,
          userId: context.user.id,
        });
        if (pendingUpload.purpose !== "photo_tasting_entry") {
          throw new PendingUploadError("Pending upload purpose mismatch.");
        }
      } catch (err) {
        if (err instanceof PendingUploadError) {
          throw errors.BAD_REQUEST({
            message: err.message || "Pending photo is no longer available.",
          });
        }
        throw err;
      }
    }

    const tags = await validateTags(input.tags);
    const friendUserIds = Array.from(new Set(input.friends));
    if (friendUserIds.length) {
      const matches = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.fromUserId, context.user.id),
            eq(follows.status, "following"),
            inArray(follows.toUserId, friendUserIds),
          ),
        );
      if (matches.length !== friendUserIds.length) {
        throw errors.BAD_REQUEST({
          message: "Friends must all be active relationships.",
        });
      }
    }

    let review = await db.transaction(async (tx) => {
      try {
        await resolveActiveBottleIds(tx, [input.bottle], { lock: "update" });
      } catch (error) {
        if (!(error instanceof ActiveBottleSelectionError)) throw error;
        if (error.reason === "missing") {
          throw errors.NOT_FOUND({ message: "Bottle not found." });
        }
        throw errors.CONFLICT({ message: "Bottle is not active." });
      }

      const [stored] = await tx
        .insert(memberReviews)
        .values({
          bottleId: input.bottle,
          createdById: context.user.id,
          score: input.score,
          tags,
          color: input.color,
          notes: input.notes,
          servingStyle: input.servingStyle,
          friends: friendUserIds,
        })
        .onConflictDoUpdate({
          target: [memberReviews.bottleId, memberReviews.createdById],
          set: {
            score: input.score,
            tags,
            color: input.color,
            notes: input.notes,
            servingStyle: input.servingStyle,
            friends: friendUserIds,
            updatedAt: sql`NOW()`,
          },
        })
        .returning();
      if (!stored) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Unable to save review.",
        });
      }
      return stored;
    });

    if (input.pendingImageId) {
      try {
        const imageUrl = await copyPendingImageToMemberReview({
          id: input.pendingImageId,
          userId: context.user.id,
          purpose: "photo_tasting_entry",
          memberReviewId: review.id,
        });
        const [updated] = await db
          .update(memberReviews)
          .set({ imageUrl })
          .where(eq(memberReviews.id, review.id))
          .returning();
        if (updated) review = updated;
      } catch (err) {
        logError(err, {
          memberReview: { id: review.id },
          pendingUpload: { id: input.pendingImageId },
        });
      }
    }

    await dispatchBottleStatsRecompute(
      "memberReview",
      review.id,
      review.bottleId,
    );
    return await serialize(MemberReviewSerializer, review, context.user);
  });
