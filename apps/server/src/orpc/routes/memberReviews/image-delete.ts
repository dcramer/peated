import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { MemberReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "DELETE",
    path: "/bottles/{bottle}/member-review/image",
    summary: "Delete my member review image",
    operationId: "deleteMemberReviewImage",
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(MemberReviewSchema)
  .handler(async ({ input, context, errors }) => {
    const [updated] = await db
      .update(memberReviews)
      .set({ imageUrl: null, updatedAt: sql`NOW()` })
      .where(
        and(
          eq(memberReviews.bottleId, input.bottle),
          eq(memberReviews.createdById, context.user.id),
        ),
      )
      .returning();
    if (!updated) {
      throw errors.NOT_FOUND({ message: "Review not found." });
    }

    return await serialize(MemberReviewSerializer, updated, context.user);
  });
