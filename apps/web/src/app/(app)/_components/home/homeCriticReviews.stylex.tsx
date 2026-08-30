"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";

import {
  LoadingList,
  SectionError,
} from "@peated/web/components/designSystem/components";
import { CriticReviewCards } from "@peated/web/components/designSystem/patterns/homeDiscovery.stylex";
import { HomeSectionLoading } from "@peated/web/components/designSystem/patterns/homeSummary.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { useORPC } from "@peated/web/lib/orpc/context";
import { memberHomeQueries } from "@peated/web/lib/orpc/homeQueries";

type ExternalReview = Outputs["externalReviews"]["list"]["results"][number];
type Bottle = NonNullable<ExternalReview["bottle"]>;

function getBottleMetadata(bottle: Bottle) {
  return [
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
    bottle.vintageYear === null ? null : `${bottle.vintageYear} vintage`,
    bottle.maturation,
  ].filter((value): value is string => Boolean(value));
}

export function HomeCriticReviews() {
  const orpc = useORPC();
  const externalReviews = useQuery(memberHomeQueries.criticReviews(orpc));

  if (externalReviews.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent critic reviews" rows={2} />
      </HomeSectionLoading>
    );
  }

  if (externalReviews.error) {
    return (
      <SectionError
        heading="Critic reviews are unavailable"
        onRetry={() => void externalReviews.refetch()}
      >
        We couldn't load the latest critic reviews. Try again.
      </SectionError>
    );
  }

  const visibleReviews = externalReviews.data.results.filter(
    (review): review is ExternalReview & { bottle: Bottle } =>
      review.bottle !== null,
  );
  if (!visibleReviews.length) return null;

  return (
    <CriticReviewCards
      reviews={visibleReviews.map((review) => ({
        bottleHref: `/bottles/${review.bottle.id}`,
        bottleName: review.bottle.fullName,
        date: (
          <TimeSince date={review.article.publishedAt ?? review.createdAt} />
        ),
        imageUrl: review.bottle.imageUrl,
        metadata: getBottleMetadata(review.bottle),
        rating:
          review.nativeScore?.scale === 100 ? review.nativeScore.value : null,
        source: review.site?.name ?? review.reviewerName ?? "Critic review",
        sourceHref: review.url,
        summary: review.summary,
      }))}
    />
  );
}
