import { db } from "@peated/server/db";
import { bottleSeries, changes, entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireAuth } from "@peated/server/orpc/middleware/auth";
import {
  BottleSeriesInputSchema,
  BottleSeriesSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";

export default procedure
  .route({
    method: "POST",
    path: "/bottle-series",
    operationId: "createBottleSeries",
    summary: "Create bottle series",
    description:
      "Create a new bottle series for a brand with name and description",
  })
  .use(requireAuth)
  .input(BottleSeriesInputSchema)
  .output(BottleSeriesSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const series = await db.transaction(async (tx) => {
      // Get the brand to ensure it exists and to build fullName
      const [brand] = await tx
        .select()
        .from(entities)
        .where(eq(entities.id, input.brand))
        .limit(1);

      if (!brand) {
        throw errors.NOT_FOUND({
          message: "Brand not found.",
        });
      }

      const fullName = `${brand.name} ${input.name}`;

      const [existingSeries] = await tx
        .select()
        .from(bottleSeries)
        .where(eq(sql`LOWER(${bottleSeries.fullName})`, fullName.toLowerCase()))
        .limit(1);

      if (existingSeries) {
        throw new ConflictError(existingSeries);
      }

      // Create the series
      const [series] = await tx
        .insert(bottleSeries)
        .values({
          name: input.name,
          fullName,
          description: input.description,
          brandId: input.brand,
          createdById: user.id,
        })
        .returning();

      // Record the change
      await tx.insert(changes).values({
        objectId: series.id,
        objectType: "bottle_series",
        type: "add",
        displayName: series.fullName,
        data: {
          name: series.name,
          fullName: series.fullName,
          description: series.description,
          brandId: series.brandId,
        },
        createdById: user.id,
      });

      return series;
    });

    // Queue search vector indexing
    await pushJob("IndexBottleSeriesSearchVectors", {
      seriesId: series.id,
    });

    return await serialize(BottleSeriesSerializer, series, user);
  });
