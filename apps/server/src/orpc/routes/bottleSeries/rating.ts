import {
  EMPTY_REVIEW_SCORE_BAND_COUNTS,
  EMPTY_TASTING_BAND_COUNTS,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  bottleTombstones,
} from "@peated/server/db/schema";
import { aggregateBottleActivityStatsInTransaction } from "@peated/server/lib/recomputeBottleActivityStats";
import { procedure } from "@peated/server/orpc";
import { BottleSeriesRatingSchema } from "@peated/server/schemas";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-series/{series}/rating",
    summary: "Get a bottle series aggregate rating",
    description:
      "Combine the included member and critic review scores of all active Bottles in a series into one median, and sum the tasting ratings by band. Scores count only when the external review publication rules allow them.",
    operationId: "getBottleSeriesRating",
  })
  .input(z.object({ series: z.coerce.number().int().positive() }))
  .output(BottleSeriesRatingSchema)
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

    const activeBottles = await db
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

    if (!activeBottles.length) {
      return {
        totalBottles: 0,
        medianScore: null,
        minScore: null,
        maxScore: null,
        memberScoreCount: 0,
        externalScoreCount: 0,
        raterCount: 0,
        reviewScoreBandCounts: { ...EMPTY_REVIEW_SCORE_BAND_COUNTS },
        tastingBandCounts: { ...EMPTY_TASTING_BAND_COUNTS },
      };
    }

    const stats = await db.transaction((tx) =>
      aggregateBottleActivityStatsInTransaction(
        tx,
        activeBottles.map(({ id }) => id),
      ),
    );

    return {
      totalBottles: activeBottles.length,
      medianScore: stats.medianScore,
      minScore: stats.minScore,
      maxScore: stats.maxScore,
      memberScoreCount: stats.memberScoreCount,
      externalScoreCount: stats.externalScoreCount,
      raterCount: stats.raterCount,
      reviewScoreBandCounts: stats.reviewScoreBandCounts,
      tastingBandCounts: stats.tastingBandCounts,
    };
  });
