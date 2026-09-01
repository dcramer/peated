import { db } from "@peated/server/db";
import {
  bottleSeries,
  bottleSeriesTombstones,
  entities,
} from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { procedure } from "@peated/server/orpc";
import {
  BottleSeriesDetailsSchema,
  detailsResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-series/{series}",
    summary: "Get bottle series details",
    description: "Get detailed information about a bottle series by its ID.",
    spec: (spec) => ({ ...spec, operationId: "getBottleSeries" }),
  })
  .input(z.object({ series: z.coerce.number() }))
  // TODO(response-envelope): wrap in { data } by updating detailsResponse() at cutover
  .output(detailsResponse(BottleSeriesDetailsSchema))
  .handler(async function ({ input, context, errors }) {
    let [result] = await db
      .select({
        series: getTableColumns(bottleSeries),
        brand: {
          id: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          kind: entities.kind,
        },
      })
      .from(bottleSeries)
      .innerJoin(entities, eq(bottleSeries.brandId, entities.id))
      .where(eq(bottleSeries.id, input.series));

    if (!result) {
      [result] = await db
        .select({
          series: getTableColumns(bottleSeries),
          brand: {
            id: entities.id,
            name: entities.name,
            shortName: entities.shortName,
            kind: entities.kind,
          },
        })
        .from(bottleSeriesTombstones)
        .innerJoin(
          bottleSeries,
          eq(bottleSeriesTombstones.newSeriesId, bottleSeries.id),
        )
        .innerJoin(entities, eq(bottleSeries.brandId, entities.id))
        .where(eq(bottleSeriesTombstones.seriesId, input.series));

      if (!result) {
        throw errors.NOT_FOUND({
          message: "Series not found.",
        });
      }
    }

    return {
      ...(await serialize(BottleSeriesSerializer, result.series, context.user)),
      brand: {
        ...result.brand,
        peatedId: formatPeatedId("entity", result.brand.id),
      },
    };
  });
