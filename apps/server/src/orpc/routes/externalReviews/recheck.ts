import { db } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import {
  ExternalReviewResolutionVersionSchema,
  reviewResolutionVersionMatches,
} from "@peated/server/lib/externalReviewResolution";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/external-reviews/recheck",
    summary: "Recheck unresolved reviews",
    description:
      "Recheck up to 100 completed unresolved reviews using their observed name and attempt timestamp. Requires a moderator.",
    operationId: "recheckExternalReviews",
  })
  .input(
    z
      .object({
        reviews: z
          .array(
            ExternalReviewResolutionVersionSchema.extend({
              reviewId: z.number().int().positive(),
            }).strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .refine(
        ({ reviews }) =>
          new Set(reviews.map(({ reviewId }) => reviewId)).size ===
          reviews.length,
        "Supply each review once.",
      ),
  )
  .output(z.object({ queued: z.array(z.number()) }).strict())
  .handler(async ({ input, errors }) => {
    const queuedAt = new Date();
    await db.transaction(async (tx) => {
      const reviews = await tx
        .select()
        .from(externalReviews)
        .where(
          inArray(
            externalReviews.id,
            input.reviews.map(({ reviewId }) => reviewId),
          ),
        )
        .orderBy(asc(externalReviews.id))
        .for("update");
      for (const expected of input.reviews) {
        const review = reviews.find(({ id }) => id === expected.reviewId);
        if (!review || !reviewResolutionVersionMatches(review, expected))
          throw errors.CONFLICT({
            message: "A review changed. Refresh the batch before rechecking.",
          });
      }
      await tx
        .update(externalReviews)
        .set({ bottleNoMatchAt: null, updatedAt: queuedAt })
        .where(
          inArray(
            externalReviews.id,
            reviews.map(({ id }) => id),
          ),
        );
    });
    for (const [index, expected] of input.reviews.entries()) {
      try {
        await pushUniqueJob("CreateMissingBottles", {
          reviewId: expected.reviewId,
        });
      } catch (error) {
        // Review matching owns recovery: a dispatch failure must leave a visible Inbox task.
        for (const pending of input.reviews.slice(index)) {
          await db
            .update(externalReviews)
            .set({ bottleNoMatchAt: new Date() })
            .where(
              and(
                eq(externalReviews.id, pending.reviewId),
                eq(externalReviews.name, pending.name),
                eq(externalReviews.updatedAt, queuedAt),
                isNull(externalReviews.bottleId),
                isNull(externalReviews.bottleNoMatchAt),
                isNull(externalReviews.removedAt),
              ),
            );
        }
        throw error;
      }
    }
    return { queued: input.reviews.map(({ reviewId }) => reviewId) };
  });
