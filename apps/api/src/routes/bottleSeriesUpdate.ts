import { pushUniqueJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { bottleSeries, changes, entities } from "../db/schema";
import { BottleSeriesInputSchema } from "../schemas/bottleSeries";
import { serialize } from "../serializers";
import { BottleSeriesSerializer } from "../serializers/bottleSeries";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";
import { ConflictError } from "../trpc/errors";

const InputSchema = BottleSeriesInputSchema.partial().extend({
  series: z.number(),
});

export async function bottleSeriesUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const user = ctx.user;

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }

  const updatedSeries = await db.transaction(async (tx) => {
    // Get the existing series with a lock
    const [series] = await tx
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, input.series))
      .for("update");

    if (!series) {
      throw new TRPCError({
        message: "Series not found.",
        code: "NOT_FOUND",
      });
    }

    // Get the brand to build fullName
    const [brand] = await tx
      .select()
      .from(entities)
      .where(eq(entities.id, series.brandId))
      .limit(1);

    if (!brand) {
      throw new TRPCError({
        message: "Brand not found.",
        code: "NOT_FOUND",
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

  return await serialize(BottleSeriesSerializer, updatedSeries, ctx.user);
}

export default modProcedure.input(InputSchema).mutation(bottleSeriesUpdate);
