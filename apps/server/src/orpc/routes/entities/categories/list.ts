import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  entities,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CategoryEnum } from "@peated/server/schemas";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/categories",
    summary: "List entity categories",
    description:
      "Retrieve whisky categories and their counts for bottles associated with a specific entity",
    operationId: "listEntityCategories",
  })
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
          category: CategoryEnum.nullable(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, errors }) {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!entity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    const rows = await db
      .select({
        category: bottles.category,
        count: sql<string>`COUNT(*)`,
      })
      .from(bottles)
      .innerJoin(
        catalogTargets,
        and(
          eq(catalogTargets.bottleId, bottles.id),
          eq(catalogTargets.groupId, bottles.groupId),
        ),
      )
      .where(
        and(
          sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
          sql`NOT EXISTS(SELECT FROM ${bottleGroupTombstones} WHERE ${bottleGroupTombstones.groupId} = ${bottles.groupId})`,
          or(
            eq(bottles.brandId, entity.id),
            eq(bottles.bottlerId, entity.id),
            sql`EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${bottlesToDistillers.distillerId} = ${entity.id}
            )`,
          ),
        ),
      )
      .groupBy(bottles.category)
      .orderBy(asc(bottles.category));

    const results = rows.map(({ count, category }) => ({
      count: Number(count),
      category,
    }));

    return {
      results,
      totalCount: results.reduce((total, { count }) => total + count, 0),
    };
  });
