import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CursorSchema } from "@peated/server/schemas";
import {
  type SQL,
  and,
  asc,
  eq,
  getTableColumns,
  ilike,
  isNull,
} from "drizzle-orm";
import { z } from "zod";

const OutputSchema = z.object({
  results: z.array(
    z.object({
      name: z.string(),
      createdAt: z.string(),
      bottleId: z.number().nullable(),
      isCanonical: z.boolean().optional(),
    })
  ),
  rel: CursorSchema,
});

export default procedure
  .route({
    method: "GET",
    path: "/bottle-aliases",
    summary: "List bottle aliases",
    description:
      "Retrieve bottle aliases with filtering by bottle, unknown status, and search support",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().optional(),
        query: z.string().default(""),
        onlyUnknown: z.coerce.boolean().optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      })
  )
  .output(OutputSchema)
  .handler(async ({ input: { cursor, query, limit, ...input }, errors }) => {
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
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
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
      results: results.slice(0, limit).map((a) => ({
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        bottleId: a.bottleId,
        isCanonical: bottle ? bottle.fullName == a.name : undefined,
      })),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
