import { db } from "@peated/server/db";
import {
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  bottleTombstones,
} from "@peated/server/db/schema";
import { aggregateBottleActivityStatsInTransaction } from "@peated/server/lib/recomputeBottleActivityStats";
import { procedure } from "@peated/server/orpc";
import { BottleSeriesRatingSummarySchema } from "@peated/server/schemas/bottleSeries";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-series/{series}/rating-summary",
    summary: "Get a bottle series rating summary",
    description:
      "Combine review scores and tasting ratings from active bottles in a series. The median uses the individual included review scores.",
    operationId: "getBottleSeriesRatingSummary",
  })
  .input(z.object({ series: z.coerce.number().int().positive() }))
  .output(BottleSeriesRatingSummarySchema)
  .handler(async ({ input, errors }) => {
    let [series] = await db
      .select({ id: bottleSeries.id })
      .from(bottleSeries)
      .where(eq(bottleSeries.id, input.series))
      .limit(1);

    if (!series) {
      [series] = await db
        .select({ id: bottleSeries.id })
        .from(bottleSeriesTombstones)
        .innerJoin(
          bottleSeries,
          eq(bottleSeriesTombstones.newSeriesId, bottleSeries.id),
        )
        .where(eq(bottleSeriesTombstones.seriesId, input.series))
        .limit(1);
    }
    if (!series) throw errors.NOT_FOUND({ message: "Series not found." });

    return db.transaction(async (tx) => {
      const seriesBottles = await tx
        .select({ id: bottles.id })
        .from(bottles)
        .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
        .where(
          and(
            eq(bottles.seriesId, series.id),
            isNotNull(bottles.groupId),
            isNull(bottleTombstones.bottleId),
          ),
        );
      const stats = await aggregateBottleActivityStatsInTransaction(
        tx,
        seriesBottles.map(({ id }) => id),
      );
      return {
        medianScore: stats.medianScore,
        memberScoreCount: stats.memberScoreCount,
        externalScoreCount: stats.externalScoreCount,
        tastingBandCounts: stats.tastingBandCounts,
      };
    });
  });
