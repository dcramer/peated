import { db } from "@peated/server/db";
import { bottleSeries, changes, entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import {
  BottleSeriesInputSchema,
  BottleSeriesSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSeriesSerializer } from "@peated/server/serializers/bottleSeries";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = BottleSeriesInputSchema.partial().extend({
  series: z.coerce.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-series/{series}",
    summary: "Update bottle series",
    spec: {},
    description:
      "Update bottle series information including name and description. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(BottleSeriesSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const updatedSeries = await db.transaction(async (tx) => {
      // Get the existing series with a lock
      const [series] = await tx
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.id, input.series))
        .for("update");

      if (!series) {
        throw errors.NOT_FOUND({
          message: "Series not found.",
        });
      }

      // Get the brand to build fullName
      const [brand] = await tx
        .select()
        .from(entities)
        .where(eq(entities.id, series.brandId))
        .limit(1);

      if (!brand) {
        throw errors.NOT_FOUND({
          message: "Brand not found.",
        });
      }

      // Check for existing series with same attributes
      const newData = {
        name: input.name !== undefined ? input.name : undefined,
        description:
          input.description !== undefined ? input.description : undefined,
        fullName:
          input.name !== undefined ? `${brand.name} ${input.name}` : undefined,
        updatedAt: new Date(),
      };

      // Check for conflicts
      const [existingSeries] = await tx
        .select()
        .from(bottleSeries)
        .where(
          and(
            eq(
              sql`LOWER(${bottleSeries.fullName})`,
              (newData.fullName ?? series.fullName).toLowerCase(),
            ),
            ne(bottleSeries.id, series.id),
          ),
        );

      if (existingSeries) {
        throw new ConflictError(
          existingSeries,
          undefined,
          "A series with this name already exists.",
        );
      }

      // Update the series
      const [updatedSeries] = await tx
        .update(bottleSeries)
        .set(newData)
        .where(eq(bottleSeries.id, series.id))
        .returning();

      // Record the change
      await tx.insert(changes).values({
        objectId: series.id,
        objectType: "bottle_series",
        type: "update",
        displayName: updatedSeries.fullName,
        data: {
          name:
            updatedSeries.name !== series.name ? updatedSeries.name : undefined,
          description:
            updatedSeries.description !== series.description
              ? updatedSeries.description
              : undefined,
          fullName:
            updatedSeries.fullName !== series.fullName
              ? updatedSeries.fullName
              : undefined,
        },
        createdById: user.id,
      });

      return updatedSeries;
    });

    // Queue search vector indexing
    await pushUniqueJob(
      "IndexBottleSeriesSearchVectors",
      {
        seriesId: updatedSeries.id,
      },
      { delay: 5000 },
    );

    return await serialize(BottleSeriesSerializer, updatedSeries, context.user);
  });
