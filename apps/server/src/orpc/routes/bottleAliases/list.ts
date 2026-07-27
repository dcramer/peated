import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { listResponse } from "@peated/server/schemas";
import { and, asc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = listResponse(
  z.object({
    name: z.string(),
    createdAt: z.string(),
    bottleId: z.number().nullable(),
    isCanonical: z.boolean().optional(),
  }),
);

export default procedure
  .route({
    method: "GET",
    path: "/bottle-aliases",
    summary: "List bottle aliases",
    description:
      "Retrieve bottle aliases with filtering by bottle, unknown status, and search support",
    operationId: "listBottleAliases",
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
      .strict()
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(OutputSchema)
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    errors,
  }) {
    const where: SQL<unknown>[] = [
      sql`${bottleAliases.ignored} IS DISTINCT FROM TRUE`,
    ];

    let bottle: { id: number; fullName: string } | null = null;
    if (input.bottle) {
      [bottle] = await db
        .select({
          id: bottles.id,
          fullName: bottles.fullName,
        })
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
    const results = await db
      .select({
        name: bottleAliases.name,
        createdAt: bottleAliases.createdAt,
        bottleId: bottleAliases.bottleId,
      })
      .from(bottleAliases)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleAliases.name));

    return {
      results: results.slice(0, limit).map((alias) => ({
        name: alias.name,
        createdAt: alias.createdAt.toISOString(),
        bottleId: alias.bottleId,
        isCanonical: bottle ? bottle.fullName === alias.name : undefined,
      })),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
