import { db } from "@peated/server/db";
import { badgeAwards } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { BadgeAwardSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/badges",
    summary: "List user badges",
    description:
      "Retrieve badges earned by a user with pagination support. Respects privacy settings",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(BadgeAwardSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({
    input: { cursor, limit, ...input },
    context,
    errors,
  }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is not public.",
      });
    }

    const offset = (cursor - 1) * limit;

    const results = await db
      .select()
      .from(badgeAwards)
      .where(and(eq(badgeAwards.userId, user.id), gte(badgeAwards.xp, 0)))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(
        sql`CASE WHEN ${badgeAwards.level} = 0 THEN 1 ELSE 0 END`,
        desc(badgeAwards.createdAt),
      );

    return {
      results: await serialize(
        BadgeAwardSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
