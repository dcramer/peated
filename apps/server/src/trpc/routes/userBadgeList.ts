import { db } from "@peated/server/db";
import { badgeAwards } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BadgeAwardSerializer } from "@peated/server/serializers/badgeAward";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";

export default publicProcedure
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.number()]),
      cursor: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { cursor, limit, ...input }, ctx }) {
    const user = await getUserFromId(db, input.user, ctx.user);
    if (!user) {
      throw new TRPCError({
        message: "User not found.",
        code: "NOT_FOUND",
      });
    }

    if (!(await profileVisible(db, user, ctx.user))) {
      throw new TRPCError({
        message: "User's profile is not public.",
        code: "BAD_REQUEST",
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
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
