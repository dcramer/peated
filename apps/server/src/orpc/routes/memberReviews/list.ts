import { db } from "@peated/server/db";
import { follows, memberReviews, users } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { MemberReviewSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/member-reviews",
    summary: "List member reviews",
    operationId: "listMemberReviews",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      cursor: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  )
  .output(listResponse(MemberReviewSchema))
  .handler(async ({ input, context }) => {
    const offset = (input.cursor - 1) * input.limit;
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
    const rows = await db
      .select({ review: memberReviews })
      .from(memberReviews)
      .innerJoin(users, eq(users.id, memberReviews.createdById))
      .where(and(eq(memberReviews.bottleId, input.bottle), visible))
      .orderBy(desc(memberReviews.updatedAt), desc(memberReviews.id))
      .limit(input.limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        MemberReviewSerializer,
        rows.slice(0, input.limit).map(({ review }) => review),
        context.user,
      ),
      rel: {
        nextCursor: rows.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
