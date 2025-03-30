import type { Entity } from "@peated/server/db/schema";
import { bottleSeries, changes } from "@peated/server/db/schema";
import type { BottleSeriesInputSchema } from "@peated/server/schemas";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { AnyTransaction } from "../db";

// returns [seriesId, created]
export async function processSeries({
  tx,
  series,
  brand,
  userId,
}: {
  tx: AnyTransaction;
  series:
    | Omit<z.infer<typeof BottleSeriesInputSchema>, "brand">
    | number
    | null;
  brand: Entity;
  userId: number;
}): Promise<[number | null, boolean]> {
  if (!series) return [null, false];

  // If series is a number, it's an existing series ID
  if (typeof series === "number") {
    const existingSeries = await tx.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, series),
    });
    if (!existingSeries) {
      throw new TRPCError({
        message: "Series not found.",
        code: "NOT_FOUND",
      });
    }
    return [series, false];
  }

  // Handle series object input
  const fullName = `${brand.name} ${series.name}`;

  // Check for existing series
  const [existingSeries] = await tx
    .select()
    .from(bottleSeries)
    .where(eq(sql`LOWER(${bottleSeries.fullName})`, fullName.toLowerCase()))
    .limit(1);

  if (existingSeries) {
    return [existingSeries.id, false];
  }

  // Create new series
  const [newSeries] = await tx
    .insert(bottleSeries)
    .values({
      name: series.name,
      description: series.description,
      fullName,
      brandId: brand.id,
      numReleases: 1,
      createdById: userId,
    })
    .returning();

  // Record the change
  await tx.insert(changes).values({
    objectId: newSeries.id,
    objectType: "bottle_series",
    type: "add",
    displayName: newSeries.fullName,
    data: {
      name: newSeries.name,
      fullName: newSeries.fullName,
      brandId: newSeries.brandId,
    },
    createdById: userId,
  });

  return [newSeries.id, true];
}
