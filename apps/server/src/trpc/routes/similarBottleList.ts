import { db } from "@peated/server/db";
import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
      const d1 = alias(bottlesToDistillers, "d1");
      const d2 = alias(bottlesToDistillers, "d2");
      results = await db
        .select()
        .from(bottles)
        .where(
          and(
            eq(bottles.brandId, bottle.brandId),
            // eq(bottles.category, bottle.category),
            ne(bottles.id, bottle.id),
            sql`EXISTS (
              SELECT FROM ${bottlesToDistillers} as d1
              INNER JOIN ${bottlesToDistillers} as d2
                ON ${d1.distillerId} = ${d2.distillerId}
              WHERE ${d1.bottleId} = ${bottles.id}
                AND ${d2.bottleId} = ${bottle.id})`,
          ),
        )
        .limit(limit)
        .orderBy(asc(bottles.fullName));
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
