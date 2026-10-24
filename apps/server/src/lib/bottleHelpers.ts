import { ORPCError } from "@orpc/server";
import type { Entity } from "@peated/server/db/schema";
import { bottleSeries, changes } from "@peated/server/db/schema";
import { buildBottleSeriesSearchDocument } from "@peated/server/lib/search";
import { BottleSeriesInputSchema } from "@peated/server/schemas";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AnyDatabase, AnyTransaction } from "../db";

/** Finds the Series that `processSeries` reuses for a Series name under a brand. */
export async function findSeriesIdByName(
  database: AnyDatabase,
  { brand, name }: { brand: Pick<Entity, "name">; name: string },
): Promise<number | null> {
  const fullName = `${brand.name} ${name}`;
  const [existingSeries] = await database
    .select({ id: bottleSeries.id })
    .from(bottleSeries)
    .where(eq(sql`LOWER(${bottleSeries.fullName})`, fullName.toLowerCase()))
    .limit(1);
  return existingSeries?.id ?? null;
}

/**
 * Resolves or creates a bottle series using the caller-provided actor for
 * creation attribution. A new Series gets its search document in the same
 * transaction so text search finds it before the indexing job runs.
 */
export async function processSeries({
  tx,
  series,
  brand,
  createdByActorId,
}: {
  tx: AnyTransaction;
  series:
    | Omit<z.infer<typeof BottleSeriesInputSchema>, "brand">
    | number
    | null;
  brand: Entity;
  createdByActorId: number;
}): Promise<number | null> {
  if (!series) return null;

  // If series is a number, it's an existing series ID
  const seriesId = z.number().safeParse(series);
  if (seriesId.success) {
    const existingSeries = await tx.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, seriesId.data),
    });
    if (!existingSeries) {
      throw new ORPCError("NOT_FOUND", {
        message: "Series not found.",
      });
    }
    return seriesId.data;
  }

  // Handle series object input
  const seriesDraft = BottleSeriesInputSchema.omit({ brand: true }).parse(
    series,
  );
  const fullName = `${brand.name} ${seriesDraft.name}`;

  const existingSeriesId = await findSeriesIdByName(tx, {
    brand,
    name: seriesDraft.name,
  });
  if (existingSeriesId !== null) {
    return existingSeriesId;
  }

  const actorId = createdByActorId;

  // Create new series
  const seriesData = {
    name: seriesDraft.name,
    description: seriesDraft.description,
    fullName,
    brandId: brand.id,
    createdByActorId: actorId,
  };
  const [newSeries] = await tx
    .insert(bottleSeries)
    .values({
      ...seriesData,
      ...buildBottleSeriesSearchDocument(seriesData, brand),
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
    actorId,
  });

  return newSeries.id;
}
