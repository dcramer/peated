import { db } from "@peated/server/db";
import { bottles, tastings } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/tags",
    operationId: "getBottleTags",
    summary: "Get bottle tags",
    description:
      "Retrieve tags associated with a bottle and their usage counts from tastings",
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          tag: z.string(),
          count: z.number(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, errors }) {
    const { limit, ...rest } = input;
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, rest.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    const results = await db.query.bottleTags.findMany({
      where: (bottleTags, { eq }) => eq(bottleTags.bottleId, bottle.id),
      orderBy: (bottleTags, { desc }) => desc(bottleTags.count),
      limit,
    });

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const totalCount = (
      await db.execute<{ count: string }>(
        sql`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.bottleId} = ${bottle.id}
        AND array_length(${tastings.tags}, 1) > 0
      `,
      )
    ).rows[0].count;

    return {
      results: results.map(({ tag, count }) => ({ tag, count })),
      totalCount: Number(totalCount),
    };
  });
