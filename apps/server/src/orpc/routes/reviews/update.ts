import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  review: z.coerce.number(),
  bottle: z.number().nullable().optional(),
  hidden: z.boolean().optional(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/reviews/{review}",
    summary: "Update review",
    description:
      "Update review properties such as visibility. Requires moderator privileges",
    operationId: "updateReview",
  })
  .input(InputSchema)
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const { review: reviewId, bottle: nextBottleId, hidden } = input;
    const hasBottleUpdate = nextBottleId !== undefined;
    const hasHiddenUpdate = hidden !== undefined;

    if (!hasBottleUpdate && !hasHiddenUpdate) {
      const review = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewId),
      });
      if (!review) {
        throw errors.NOT_FOUND({ message: "Review not found." });
      }
      return await serialize(ReviewSerializer, review, context.user);
    }

    const updatedReview = await db.transaction(async (tx) => {
      if (nextBottleId !== undefined && nextBottleId !== null) {
        try {
          await resolveActiveBottleIds(tx, [nextBottleId], { lock: "update" });
        } catch (error) {
          if (!(error instanceof ActiveBottleSelectionError)) throw error;
          if (error.reason === "missing") {
            throw errors.NOT_FOUND({ message: "Bottle not found." });
          }
          throw errors.CONFLICT({
            message:
              error.reason === "bottle_retired"
                ? `Bottle ${nextBottleId} is retired.`
                : `Bottle ${nextBottleId} is not active.`,
          });
        }
      }

      const [lockedReview] = await tx
        .select()
        .from(reviews)
        .where(eq(reviews.id, reviewId))
        .limit(1)
        .for("update");
      if (!lockedReview) {
        throw errors.NOT_FOUND({ message: "Review not found." });
      }

      const [review] = await tx
        .update(reviews)
        .set({
          ...(hasBottleUpdate ? { bottleId: nextBottleId } : {}),
          ...(hasHiddenUpdate ? { hidden } : {}),
        })
        .where(eq(reviews.id, reviewId))
        .returning();
      if (!review) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update review.",
        });
      }

      if (
        nextBottleId != null &&
        shouldRecordIncomingBottleDecision({
          previousBottleId: lockedReview.bottleId,
          bottleId: nextBottleId,
          decision: "match_existing",
        })
      ) {
        const actor = await getUserActorForDatabase(tx, context.user);
        await recordIncomingBottleDecisionInTransaction(tx, {
          sourceKind: "review",
          sourceId: review.id,
          externalSiteId: review.externalSiteId,
          name: review.name,
          url: review.url,
          decision: "match_existing",
          actor,
          bottleId: nextBottleId,
          releaseId: null,
          targetId: null,
        });
      }

      return review;
    });

    return await serialize(ReviewSerializer, updatedReview, context.user);
  });
