import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { and, asc, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../trpc";

export default publicProcedure
  .input(
    z
      .object({
        bottle: z.number().optional(),
        query: z.string().default(""),
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

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(tags.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(tags)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(tags.name));

    return {
      results: await serialize(
        TagSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
