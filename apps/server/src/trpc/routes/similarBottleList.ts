import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      bottle: z.number(),
      limit: z.number().gte(1).lte(100).default(25),
    }),
  )
  .query(async function ({ input: { limit, ...input }, ctx }) {
    ctx.maxAge = 300;

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

    // we're just finding vintages right now
    let results = await db
      .select()
      .from(bottles)
      .where(
        and(
          eq(bottles.brandId, bottle.brandId),
          eq(bottles.name, bottle.name),
          ne(bottles.id, bottle.id),
        ),
      )
      .limit(limit)
      .orderBy(asc(bottles.fullName));

    if (!results.length) {
      results = await db
        .select()
        .from(bottles)
        .where(
          and(
            eq(bottles.brandId, bottle.brandId),
            sql`${bottles.searchVector} @@ websearch_to_tsquery ('english', ${bottle.name})`,
            ne(bottles.id, bottle.id),
          ),
        )
        .limit(limit)
        .orderBy(
          sql`ts_rank(${bottles.searchVector}, websearch_to_tsquery('english', ${bottle.name})) DESC`,
        );
    }

    return {
      results: await serialize(BottleSerializer, results, ctx.user, [
        "description",
        "tastingNotes",
      ]),
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    };
  });
