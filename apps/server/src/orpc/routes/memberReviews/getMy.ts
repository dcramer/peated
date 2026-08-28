import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { MemberReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/bottles/{bottle}/member-review",
    summary: "Get my member review",
    operationId: "getMyMemberReview",
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }))
  .output(MemberReviewSchema.nullable())
  .handler(async ({ input, context }) => {
    const review = await db.query.memberReviews.findFirst({
      where: and(
        eq(memberReviews.bottleId, input.bottle),
        eq(memberReviews.createdById, context.user.id),
      ),
    });
    return review
      ? await serialize(MemberReviewSerializer, review, context.user)
      : null;
  });
