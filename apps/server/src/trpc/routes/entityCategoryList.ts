import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      entity: z.number(),
    }),
  )
  .query(async function ({ input, ctx }) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw new TRPCError({
        message: "Entity not found.",
        code: "NOT_FOUND",
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
