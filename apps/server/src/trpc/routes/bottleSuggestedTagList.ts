import { DEFAULT_TAGS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottleTags, bottles } from "@peated/server/db/schema";
import { shuffle } from "@peated/server/lib/rand";
import { TRPCError } from "@trpc/server";
import { desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
    }),
  )
  .query(async function ({ input }) {
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

    // TODO: change the logic to be weighted:
    // 1. high: recorded for this bottle (e.g. Hibiki 12-year-old)
    // 2. medium: recorded for this brand (e.g. Hibiki)
    // 3. low: recorded for this category (e.g. bourbon)
    const usedTags = Object.fromEntries(
      (
        await db
          .select({
            tag: bottleTags.tag,
            total: sql<string>`SUM(${bottleTags.count})`.as("total"),
          })
          .from(bottleTags)
          .innerJoin(bottles, eq(bottles.id, bottleTags.bottleId))
          .where(
            or(
              eq(bottleTags.bottleId, bottle.id),
              eq(bottles.brandId, bottle.brandId),
            ),
          )
          .groupBy(bottleTags.tag)
          .orderBy(desc(sql`total`))
      ).map((t) => [t.tag, t.total]),
    );

    const results = shuffle(DEFAULT_TAGS)
      .map((t) => ({
        tag: t,
        count: Number(usedTags[t] || 0),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      results,
    };
  });
