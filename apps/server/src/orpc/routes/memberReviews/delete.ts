import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/bottles/{bottle}/member-review",
    summary: "Delete my member review",
    operationId: "deleteMemberReview",
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(z.object({}))
  .handler(async ({ input, context, errors }) => {
    const [review] = await db
      .delete(memberReviews)
      .where(
        and(
          eq(memberReviews.bottleId, input.bottle),
          eq(memberReviews.createdById, context.user.id),
        ),
      )
      .returning();
    if (!review) {
      throw errors.NOT_FOUND({ message: "Review not found." });
    }

    await dispatchBottleStatsRecompute(
      "memberReview",
      review.id,
      review.bottleId,
    );
    return {};
  });
