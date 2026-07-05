import { db } from "@peated/server/db";
import { bottleSeries, entities } from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { buildBottleSeriesSearchVector } from "@peated/server/lib/search";
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

  logInfo("Updating search vector for series {seriesId}", {
    extra: {
      seriesId: series.id,
    },
  });

  await db
    .update(bottleSeries)
    .set({
      searchVector,
    })
    .where(eq(bottleSeries.id, series.id));
};
