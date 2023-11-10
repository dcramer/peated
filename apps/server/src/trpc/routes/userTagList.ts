import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";

export default publicProcedure
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.number()]),
    }),
  )
  .query(async function ({ input, ctx }) {
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

    const results = await db.execute<{ tag: string; count: string }>(
      sql<{ tag: string; count: string }>`SELECT tag, COUNT(tag) as count
    FROM (
      SELECT unnest(${tastings.tags}) as tag
      FROM ${tastings}
      WHERE ${tastings.createdById} = ${user.id}
    ) as t
    GROUP BY tag
    ORDER BY count DESC
    LIMIT 25`,
    );

    const totalCount = Number(
      (
        await db.execute<{ count: string }>(
          sql<{ count: number }>`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
        )
      ).rows[0].count,
    );

    return {
      results: results.rows.map(({ tag, count }) => ({
        tag,
        count: Number(count),
      })),
      totalCount,
    };
  });
