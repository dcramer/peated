"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";

import { useORPC } from "../../../lib/orpc/context";
import TimeSince from "../../timeSince";
import { LoadingList, SectionError } from "../components";
import { HomeCriticReviews as CriticReviewSection } from "../patterns/homeDiscovery.stylex";
import { HomeSectionLoading } from "../patterns/homeSummary.stylex";

type Review = Outputs["reviews"]["list"]["results"][number];
type Bottle = NonNullable<Review["bottle"]>;

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
  const reviews = useQuery(
    orpc.reviews.list.queryOptions({
      input: { limit: 2, sort: "recent" },
    }),
  );

  if (reviews.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent critic reviews" rows={2} />
      </HomeSectionLoading>
    );
  }

  if (reviews.error) {
    return (
      <SectionError
        heading="Critic reviews are unavailable"
        onRetry={() => void reviews.refetch()}
      >
        We couldn't load the latest critic reviews. Try again.
      </SectionError>
    );
  }

  const visibleReviews = reviews.data.results.filter(
    (review): review is Review & { bottle: Bottle } => review.bottle !== null,
  );
  if (!visibleReviews.length) return null;

  return (
    <CriticReviewSection
      reviews={visibleReviews.map((review) => ({
        bottleHref: `/bottles/${review.bottle.id}`,
        bottleName: review.bottle.fullName,
        date: (
          <TimeSince date={review.article.publishedAt ?? review.createdAt} />
        ),
        imageUrl: review.bottle.imageUrl,
        metadata: getBottleMetadata(review.bottle),
        score: review.rating ?? review.nativeScore?.display,
        source: review.site?.name ?? review.reviewerName ?? "Critic review",
        sourceHref: review.url,
        summary: review.summary,
      }))}
    />
  );
}
