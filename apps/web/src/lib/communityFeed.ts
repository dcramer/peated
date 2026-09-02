import type { Outputs } from "@peated/server/orpc/router";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { CommunityFeedItem } from "@peated/web/components/communityFeed.stylex";
import { RATING_BANDS } from "@peated/web/components/scoring.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";

type CriticReview = Outputs["externalReviews"]["list"]["results"][number];
type MemberTasting = Outputs["tastings"]["list"]["results"][number];

export function getCommunityFeedItems({
  criticReviews,
  memberTastings,
}: {
  criticReviews: readonly CriticReview[];
  memberTastings: readonly MemberTasting[];
}): CommunityFeedItem[] {
  const criticItems = criticReviews.flatMap((review): CommunityFeedItem[] => {
    if (!review.bottle) return [];

    const source = review.site?.name ?? review.reviewerName ?? "Critic";
    return [
      {
        actor: source,
        bottleHref: getBottleUrl(review.bottle),
        date: review.article.publishedAt ?? review.createdAt,
        description: getPreview(review.article.title),
        href: review.url,
        id: `critic-${review.id}`,
        imageUrl: review.bottle.imageUrl,
        kind: "Critic review",
        metadata: getBottleMetadata(review.bottle),
        rating:
          review.nativeScore?.scale === 100
            ? String(review.nativeScore.value)
            : undefined,
        title: formatBottleDisplayName(review.bottle),
      },
    ];
  });
  const tastingItems = memberTastings.map(
    (tasting): CommunityFeedItem => ({
      actor: tasting.createdBy.username,
      actorHref: `/users/${tasting.createdBy.username}`,
      bottleHref: getBottleUrl(tasting.bottle),
      date: tasting.createdAt,
      description: getPreview(tasting.notes),
      href: `/tastings/${tasting.id}`,
      id: `tasting-${tasting.id}`,
      imageUrl: tasting.bottle.imageUrl,
      kind: "Member tasting",
      metadata: getBottleMetadata(tasting.bottle),
      rating: tasting.ratingBand
        ? RATING_BANDS.find((band) => band.key === tasting.ratingBand)?.label
        : undefined,
      title: formatBottleDisplayName(tasting.bottle),
    }),
  );

  return [...criticItems, ...tastingItems].sort(
    (left, right) => Date.parse(right.date) - Date.parse(left.date),
  );
}

const PREVIEW_LENGTH = 160;

function getPreview(value?: string | null) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (normalized.length <= PREVIEW_LENGTH) return normalized;

  const wordBoundary = normalized.slice(0, PREVIEW_LENGTH + 1).lastIndexOf(" ");
  const cutoff = wordBoundary > 0 ? wordBoundary : PREVIEW_LENGTH;
  return `${normalized.slice(0, cutoff).trimEnd()}…`;
}
