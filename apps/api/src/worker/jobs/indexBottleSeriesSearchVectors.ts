import { db } from "@peated/api/db";
import { bottleSeries, entities } from "@peated/api/db/schema";
import { buildBottleSeriesSearchVector } from "@peated/api/lib/search";
import { eq } from "drizzle-orm";

export default async ({ seriesId }: { seriesId: number }) => {
  const series = await db.query.bottleSeries.findFirst({
    where: (bottleSeries, { eq }) => eq(bottleSeries.id, seriesId),
  });
  if (!series) {
    throw new Error(`Unknown series: ${seriesId}`);
  }

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, series.brandId));

  const searchVector = buildBottleSeriesSearchVector(series, brand!) || null;

  console.log(`Updating searchVector for Series ${series.id}`);

  await db
    .update(bottleSeries)
    .set({
      searchVector,
    })
    .where(eq(bottleSeries.id, series.id));
};
