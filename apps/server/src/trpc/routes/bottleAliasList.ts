import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, getTableColumns, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z
      .object({
        bottle: z.number().optional(),
        query: z.string().default(""),
        onlyUnknown: z.boolean().optional(),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { cursor, query, limit, ...input }, ctx }) {
    const where: (SQL<unknown> | undefined)[] = [];

    let bottle: Bottle | null = null;
    if (input.bottle) {
      [bottle] = await db
        .select()
        .from(bottles)
        .where(eq(bottles.id, input.bottle));

      if (!bottle) {
        throw new TRPCError({
          message: "Bottle not found.",
          code: "NOT_FOUND",
        });
      }
      where.push(eq(bottleAliases.bottleId, bottle.id));
    }

    if (input.onlyUnknown) {
      where.push(isNull(bottleAliases.bottleId));
    }

    if (query) {
      where.push(ilike(bottleAliases.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;

    const { embedding, ...columns } = getTableColumns(bottleAliases);
    const results = await db
      .select(columns)
      .from(bottleAliases)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleAliases.name));

    return {
      results: results.map((a) => ({
        name: a.name,
        isCanonical: bottle
          ? `${bottle.fullName}${bottle.vintageYear ? ` (${bottle.vintageYear})` : ""}` ==
            a.name
          : undefined,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });
