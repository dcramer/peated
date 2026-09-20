"use client";

import type { Outputs } from "@peated/server/orpc/router";
import {
  LoadingPlaceholder,
  SectionError,
} from "@peated/web/components/feedback.stylex";
import { BottleRatingSummary } from "@peated/web/components/scoring.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

type SeriesRating = Outputs["bottleSeries"]["rating"];

/**
 * One aggregate rating for every active Bottle in a Series, loaded after the
 * details so the catalog response stays fast. Renders nothing when the Series
 * has no ratings.
 */
export function SeriesRatingSummary({ series }: { series: number }) {
  const orpc = useORPC();
  const query = useQuery(
    orpc.bottleSeries.rating.queryOptions({ input: { series } }),
  );

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading series rating">
        <LoadingPlaceholder preset="text" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <SectionError
        heading="Could not load series rating"
        onRetry={() => void query.refetch()}
      >
        Try loading the rating again.
      </SectionError>
    );
  }

  const rating: SeriesRating = query.data;
  return (
    <BottleRatingSummary
      externalScoreCount={rating.externalScoreCount}
      label="Series rating"
      median={rating.medianScore}
      memberScoreCount={rating.memberScoreCount}
      tastingCounts={rating.tastingBandCounts}
    />
  );
}
