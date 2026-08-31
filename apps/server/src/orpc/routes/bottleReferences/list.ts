import { db } from "@peated/server/db";
import { bottleReferences, bottles } from "@peated/server/db/schema";
import { getBottleReferenceStateToken } from "@peated/server/lib/bottleReferenceReview";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { listResponse } from "@peated/server/schemas";
import { and, asc, eq, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = listResponse(
  z.object({
    id: z.number(),
    name: z.string(),
    createdAt: z.string(),
    bottleId: z.number().nullable(),
    isCanonical: z.boolean().optional(),
    assignmentSource: z.string(),
    reviewedAt: z.string().nullable(),
    stateToken: z.string(),
  }),
);

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottle-references",
    summary: "List bottle references",
    description:
      "Retrieve bottle references with filtering by bottle, unknown status, and search support",
    operationId: "listBottleReferences",
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
      sql`${bottleReferences.ignored} IS DISTINCT FROM TRUE`,
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
      where.push(eq(bottleReferences.bottleId, bottle.id));
    }

    if (input.onlyUnknown) {
      where.push(isNull(bottleReferences.bottleId));
    }

    if (query) {
      where.push(ilike(bottleReferences.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;
    const results = await db
      .select({
        id: bottleReferences.id,
        name: bottleReferences.name,
        createdAt: bottleReferences.createdAt,
        bottleId: bottleReferences.bottleId,
        ignored: bottleReferences.ignored,
        assignmentSource: bottleReferences.assignmentSource,
        assignedByActorId: bottleReferences.assignedByActorId,
        reviewedByActorId: bottleReferences.reviewedByActorId,
        reviewedAt: bottleReferences.reviewedAt,
      })
      .from(bottleReferences)
      .where(and(...where))
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleReferences.name));

    return {
      results: results.slice(0, limit).map((reference) => ({
        id: reference.id,
        name: reference.name,
        createdAt: reference.createdAt.toISOString(),
        bottleId: reference.bottleId,
        isCanonical: bottle ? bottle.fullName === reference.name : undefined,
        assignmentSource: reference.assignmentSource,
        reviewedAt: reference.reviewedAt?.toISOString() ?? null,
        stateToken: getBottleReferenceStateToken(reference),
      })),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
