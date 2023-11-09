import { db } from "@peated/server/db";
import { bottles, tastings } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { limit, ...input } }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    const results = await db.query.bottleTags.findMany({
      where: (bottleTags, { eq }) => eq(bottleTags.bottleId, bottle.id),
      orderBy: (bottleTags, { desc }) => desc(bottleTags.count),
      limit,
    });

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const totalCount = (
      await db.execute<{ count: string }>(
        sql`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.bottleId} = ${bottle.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
      )
    ).rows[0].count;

    return {
      results: results.map(({ tag, count }) => ({ tag, count })),
      totalCount: Number(totalCount),
    };
  });
