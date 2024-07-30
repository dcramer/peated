import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { formatBottleName } from "@peated/server/lib/format";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
  getTableColumns,
  ilike,
  isNull,
  type SQL,
} from "drizzle-orm";
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
    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleAliases.ignored, false),
    ];

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

    const canonicalName = bottle ? formatBottleName(bottle) : null;

    return {
      results: results.slice(0, limit).map((a) => ({
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        ...(bottle
          ? {
              isCanonical: canonicalName == a.name,
            }
          : {}),
      })),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
