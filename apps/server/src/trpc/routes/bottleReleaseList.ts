import { db } from "@peated/server/db";
import { bottleReleases, bottles } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { TRPCError } from "@trpc/server";
import { and, eq, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
      query: z.string().default(""),
      cursor: z.number().gte(1).default(1),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { query, cursor, limit, ...input }, ctx }) {
    const offset = (cursor - 1) * limit;

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

    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleReleases.bottleId, bottle.id),
    ];

    if (query) {
      where.push(
        sql`${bottleReleases.searchVector} @@ websearch_to_tsquery ('english', ${query})`,
      );
    }

    const results = await db
      .select()
      .from(bottleReleases)
      .where(where ? and(...where) : undefined)
      .orderBy(bottleReleases.name)
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        BottleReleaseSerializer,
        results.slice(0, limit),
        ctx.user ?? undefined,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
