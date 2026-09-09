import { db } from "@peated/server/db";
import {
  bottles,
  bottleSeries,
  bottlesToDistillers,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { plainTextSearchQuery } from "@peated/server/lib/search";
import { procedure } from "@peated/server/orpc";
import {
  BottleSeriesListItemSchema,
  CursorSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-series",
    summary: "List bottle series",
    description: "Find bottle series by name, brand, or distillery.",
    spec: (spec) => ({ ...spec, operationId: "listBottleSeries" }),
  })
  .input(
    z.object({
      query: z.coerce
        .string()
        .default("")
        .describe("Search text only. Search operators are not supported."),
      brand: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe("Filter by brand ID."),
      distillery: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Filter to bottle series with active bottles from this distillery ID.",
        ),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      sort: z
        .enum(["name", "-bottles"])
        .default("name")
        .describe(
          "Use `name` for A–Z or `-bottles` for the most matching bottles first.",
        ),
    }),
  )
  .output(
    z.object({
      results: z.array(BottleSeriesListItemSchema),
      total: z.number(),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input, context }) {
    const { query, brand, distillery, cursor, limit, sort } = input;
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];

    if (brand) where.push(eq(bottleSeries.brandId, brand));

    if (query) {
      where.push(
        sql`${bottleSeries.searchVector} @@ ${plainTextSearchQuery(query)}`,
      );
    }

    const totalCount = sql<number>`count(*) over()::int`.as("total_count");
    let total = 0;
    let results;

    if (distillery) {
      // Count this distillery's active bottles once, before joining their Series.
      const matchingBottleCounts = db
        .select({
          seriesId: bottles.seriesId,
          numBottles: sql<number>`count(*)::int`.as("num_bottles"),
        })
        .from(bottlesToDistillers)
        .innerJoin(bottles, eq(bottlesToDistillers.bottleId, bottles.id))
        .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
        .where(
          and(
            eq(bottlesToDistillers.distillerId, distillery),
            isNotNull(bottles.seriesId),
            isNotNull(bottles.groupId),
            isNull(bottleTombstones.bottleId),
          ),
        )
        .groupBy(bottles.seriesId)
        .as("matching_bottle_counts");

      const matchingBottleCount = matchingBottleCounts.numBottles;
      const orderBy =
        sort === "-bottles"
          ? [
              desc(matchingBottleCount),
              asc(bottleSeries.name),
              asc(bottleSeries.id),
            ]
          : [asc(bottleSeries.name), asc(bottleSeries.id)];

      results = await db
        .select({
          series: getTableColumns(bottleSeries),
          brand: {
            id: entities.id,
            name: entities.name,
            shortName: entities.shortName,
            kind: entities.kind,
          },
          numBottles: matchingBottleCount,
          total: totalCount,
        })
        .from(bottleSeries)
        .innerJoin(entities, eq(bottleSeries.brandId, entities.id))
        .innerJoin(
          matchingBottleCounts,
          eq(matchingBottleCounts.seriesId, bottleSeries.id),
        )
        .where(where.length ? and(...where) : undefined)
        .orderBy(...orderBy)
        .limit(limit + 1)
        .offset(offset);

      total = Number(results[0]?.total ?? 0);
      if (!results.length && offset > 0) {
        const [countResult] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(bottleSeries)
          .innerJoin(
            matchingBottleCounts,
            eq(matchingBottleCounts.seriesId, bottleSeries.id),
          )
          .where(where.length ? and(...where) : undefined);
        total = Number(countResult?.total ?? 0);
      }
    } else {
      const matchingBottleCount = bottleSeries.numReleases;
      const orderBy =
        sort === "-bottles"
          ? [
              desc(matchingBottleCount),
              asc(bottleSeries.name),
              asc(bottleSeries.id),
            ]
          : [asc(bottleSeries.name), asc(bottleSeries.id)];

      results = await db
        .select({
          series: getTableColumns(bottleSeries),
          brand: {
            id: entities.id,
            name: entities.name,
            shortName: entities.shortName,
            kind: entities.kind,
          },
          numBottles: matchingBottleCount,
          total: totalCount,
        })
        .from(bottleSeries)
        .innerJoin(entities, eq(bottleSeries.brandId, entities.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(...orderBy)
        .limit(limit + 1)
        .offset(offset);

      total = Number(results[0]?.total ?? 0);
      if (!results.length && offset > 0) {
        const [countResult] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(bottleSeries)
          .where(where.length ? and(...where) : undefined);
        total = Number(countResult?.total ?? 0);
      }
    }

    const page = results.slice(0, limit);
    const serializedSeries = await serialize(
      BottleSeriesSerializer,
      page.map(({ series }) => series),
      context.user,
    );

    return {
      results: serializedSeries.map((series, index) => ({
        ...series,
        brand: {
          ...page[index].brand,
          peatedId: formatPeatedId("entity", page[index].brand.id),
        },
        numBottles: Number(page[index].numBottles),
      })),
      total,
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
