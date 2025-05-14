import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/entities/:entity/categories" })
  .input(
    z.object({
      entity: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          count: z.number(),
          category: z.string().nullable(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw new ORPCError("NOT_FOUND", {
        message: "Entity not found.",
      });
    }

    // TODO: denormalize this into (num)tastings or similar in the tags table
    const results = (
      await db.execute<{
        count: string;
        category: string | null;
      }>(
        sql`SELECT COUNT(*) as count, category
              FROM ${bottles}
              WHERE ${bottles.brandId} = ${entity.id}
                 OR ${bottles.bottlerId} = ${entity.id}
                 OR EXISTS(SELECT FROM ${bottlesToDistillers} WHERE ${bottlesToDistillers.bottleId} = ${bottles.id} AND ${bottlesToDistillers.distillerId} = ${entity.id})
              GROUP BY ${bottles.category}`,
      )
    ).rows;

    return {
      results: results.map(({ count, category }) => ({
        count: Number(count),
        category,
      })),
      totalCount: entity.totalBottles,
    };
  });
