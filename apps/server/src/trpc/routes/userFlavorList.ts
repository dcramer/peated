import { db } from "@peated/server/db";
import { bottles, tastings } from "@peated/server/db/schema";
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

    const results = await db.execute<{ flavor: string; count: string }>(
      sql<{
        flavor: string;
        count: string;
      }>`SELECT flavor, COUNT(flavor) as count
    FROM (
      SELECT ${bottles.flavorProfile} as flavor
      FROM ${bottles}
      JOIN ${tastings} ON ${bottles.id} = ${tastings.bottleId}
      WHERE ${tastings.createdById} = ${user.id}
      AND ${bottles.flavorProfile} IS NOT NULL
    ) as t
    GROUP BY flavor
    ORDER BY count DESC
    LIMIT 25`,
    );

    const totalCount = Number(
      (
        await db.execute<{ count: string }>(
          sql<{ count: number }>`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
      `,
        )
      ).rows[0]!.count,
    );

    return {
      results: results.rows.map(({ flavor, count }) => ({
        flavorProfile: flavor,
        count: Number(count),
      })),
      totalCount,
    };
  });
