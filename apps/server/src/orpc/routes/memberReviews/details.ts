import { db } from "@peated/server/db";
import {
  bottles,
  follows,
  memberReviews,
  users,
} from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import memberReviewDetailsContract from "@peated/server/orpc/contracts/memberReviews/details";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, eq, or, sql } from "drizzle-orm";

export default implement(memberReviewDetailsContract).handler(
  async ({ input, context, errors }) => {
    const visible = or(
      eq(users.private, false),
      ...(context.user
        ? [
            eq(memberReviews.createdById, context.user.id),
            sql`${memberReviews.createdById} IN (
              SELECT ${follows.toUserId}
              FROM ${follows}
              WHERE ${follows.fromUserId} = ${context.user.id}
                AND ${follows.status} = 'following'
            )`,
          ]
        : []),
    );
    const [result] = await db
      .select({ bottle: bottles, review: memberReviews })
      .from(memberReviews)
      .innerJoin(users, eq(users.id, memberReviews.createdById))
      .innerJoin(bottles, eq(bottles.id, memberReviews.bottleId))
      .where(and(eq(memberReviews.id, input.review), visible))
      .limit(1);

    if (!result) {
      throw errors.NOT_FOUND({ message: "Member review not found." });
    }

    const [review, bottle] = await Promise.all([
      serialize(MemberReviewSerializer, result.review, context.user),
      serialize(BottleSerializer, result.bottle, context.user, [], {
        includeGroupSummary: true,
      }),
    ]);

    return { ...review, bottle };
  },
);
