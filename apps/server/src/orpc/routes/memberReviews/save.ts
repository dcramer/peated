import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  MemberReviewInputSchema,
  MemberReviewSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { sql } from "drizzle-orm";
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
    }),
  )
  .output(MemberReviewSchema)
  .handler(async ({ input, context, errors }) => {
    const review = await db.transaction(async (tx) => {
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
          notes: input.notes,
        })
        .onConflictDoUpdate({
          target: [memberReviews.bottleId, memberReviews.createdById],
          set: {
            score: input.score,
            notes: input.notes,
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

    await dispatchBottleStatsRecompute(
      "memberReview",
      review.id,
      review.bottleId,
    );
    return await serialize(MemberReviewSerializer, review, context.user);
  });
