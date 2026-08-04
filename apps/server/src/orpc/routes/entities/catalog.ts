import { db } from "@peated/server/db";
import {
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CategoryEnum } from "@peated/server/schemas";
import { and, asc, desc, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

const RelatedEntitySchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable(),
  count: z.number(),
});

const activeBottleWhere = (entityId: number) =>
  and(
    isNotNull(bottles.groupId),
    sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
    or(
      eq(bottles.brandId, entityId),
      eq(bottles.bottlerId, entityId),
      sql`EXISTS(
        SELECT FROM ${bottlesToDistillers}
        WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
          AND ${bottlesToDistillers.distillerId} = ${entityId}
      )`,
    ),
  );

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}/catalog",
    summary: "Get an entity catalog summary",
    description:
      "Summarize bottle roles, categories, and related entities for a brand, bottler, or distiller",
    spec: (spec) => ({ ...spec, operationId: "getEntityCatalog" }),
  })
  .input(z.object({ entity: z.coerce.number() }))
  .output(
    z.object({
      totalBottles: z.number(),
      relationships: z.object({
        brand: z.number(),
        bottler: z.number(),
        distiller: z.number(),
      }),
      distilleryCoverage: z.object({
        documented: z.number(),
        total: z.number(),
      }),
      categories: z.array(
        z.object({
          category: CategoryEnum.nullable(),
          count: z.number(),
        }),
      ),
      related: z.object({
        brands: z.array(RelatedEntitySchema),
        bottlers: z.array(RelatedEntitySchema),
        distillers: z.array(RelatedEntitySchema),
      }),
      notableBottles: z.array(
        z.object({
          id: z.number(),
          fullName: z.string(),
          totalTastings: z.number(),
          avgRating: z.number().nullable(),
        }),
      ),
    }),
  )
  .handler(async function ({ input, errors }) {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(eq(entities.id, input.entity));
    if (!entity) {
      throw errors.NOT_FOUND({ message: "Entity not found." });
    }

    const associatedBottle = activeBottleWhere(entity.id);
    const [
      counts,
      categoryRows,
      brandRows,
      bottlerRows,
      distillerRows,
      notableBottleRows,
    ] = await Promise.all([
      db
        .select({
          totalBottles: sql<string>`COUNT(*)`,
          brand: sql<string>`COUNT(*) FILTER (WHERE ${bottles.brandId} = ${entity.id})`,
          bottler: sql<string>`COUNT(*) FILTER (WHERE ${bottles.bottlerId} = ${entity.id})`,
          distiller: sql<string>`COUNT(*) FILTER (WHERE EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
                AND ${bottlesToDistillers.distillerId} = ${entity.id}
            ))`,
          documentedDistillery: sql<string>`COUNT(*) FILTER (WHERE EXISTS(
              SELECT FROM ${bottlesToDistillers}
              WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
            ))`,
        })
        .from(bottles)
        .where(associatedBottle),
      db
        .select({
          category: bottles.category,
          count: sql<string>`COUNT(*)`,
        })
        .from(bottles)
        .where(associatedBottle)
        .groupBy(bottles.category)
        .orderBy(desc(sql`COUNT(*)`), asc(bottles.category)),
      db
        .select({
          id: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          count: sql<string>`COUNT(DISTINCT ${bottles.id})`,
        })
        .from(bottles)
        .innerJoin(entities, eq(entities.id, bottles.brandId))
        .where(and(associatedBottle, ne(entities.id, entity.id)))
        .groupBy(entities.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${bottles.id})`), asc(entities.name))
        .limit(7),
      db
        .select({
          id: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          count: sql<string>`COUNT(DISTINCT ${bottles.id})`,
        })
        .from(bottles)
        .innerJoin(entities, eq(entities.id, bottles.bottlerId))
        .where(and(associatedBottle, ne(entities.id, entity.id)))
        .groupBy(entities.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${bottles.id})`), asc(entities.name))
        .limit(7),
      db
        .select({
          id: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          count: sql<string>`COUNT(DISTINCT ${bottles.id})`,
        })
        .from(bottles)
        .innerJoin(
          bottlesToDistillers,
          eq(bottlesToDistillers.bottleId, bottles.id),
        )
        .innerJoin(entities, eq(entities.id, bottlesToDistillers.distillerId))
        .where(and(associatedBottle, ne(entities.id, entity.id)))
        .groupBy(entities.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${bottles.id})`), asc(entities.name))
        .limit(7),
      db
        .select({
          id: bottles.id,
          fullName: bottles.fullName,
          totalTastings: bottles.totalTastings,
          avgRating: bottles.avgRating,
        })
        .from(bottles)
        .where(associatedBottle)
        .orderBy(desc(bottles.totalTastings), asc(bottles.fullName))
        .limit(4),
    ]);

    const summary = counts[0];
    if (!summary) {
      throw new Error(`Missing catalog summary for Entity ${entity.id}.`);
    }

    const related = (rows: typeof brandRows) =>
      rows.map((row) => ({ ...row, count: Number(row.count) }));
    const totalBottles = Number(summary.totalBottles);

    return {
      totalBottles,
      relationships: {
        brand: Number(summary.brand),
        bottler: Number(summary.bottler),
        distiller: Number(summary.distiller),
      },
      distilleryCoverage: {
        documented: Number(summary.documentedDistillery),
        total: totalBottles,
      },
      categories: categoryRows.map((row) => ({
        category: row.category,
        count: Number(row.count),
      })),
      related: {
        brands: related(brandRows),
        bottlers: related(bottlerRows),
        distillers: related(distillerRows),
      },
      notableBottles: notableBottleRows,
    };
  });
