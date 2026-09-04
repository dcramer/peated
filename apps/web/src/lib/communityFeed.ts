import type { Outputs } from "@peated/server/orpc/router";
import type {
  CommunityFeedBottle,
  CommunityFeedItem,
} from "@peated/web/components/communityFeed.stylex";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";
import { getBottleUrl, getTastingUrl } from "@peated/web/lib/urls";

type CriticReview = Outputs["externalReviews"]["list"]["results"][number];
type Activity = Outputs["activity"]["list"]["results"][number];
type Bottle = Outputs["bottles"]["list"]["results"][number];

function feedBottle(bottle: Bottle): CommunityFeedBottle {
  return {
    id: bottle.peatedId,
    ...getBottleIdentityProps(bottle),
    href: getBottleUrl(bottle),
    imageUrl: bottle.imageUrl,
  };
}

export function getCommunityFeedItems({
  criticReviews,
  activity,
}: {
  criticReviews: readonly CriticReview[];
  activity: readonly Activity[];
}): CommunityFeedItem[] {
  const criticItems = criticReviews.flatMap((review): CommunityFeedItem[] => {
    if (!review.bottle) return [];
    const source = review.site?.name ?? review.reviewerName ?? "Critic";
    return [
      {
        id: `critic-${review.id}`,
        kind: "critic_review",
        actor: source,
        actorHref: review.url,
        actorImageUrl: review.site?.imageUrl,
        action: "published a review",
        date: review.article.publishedAt ?? review.createdAt,
        href: review.url,
        bottles: [
          {
            ...feedBottle(review.bottle),
            description: getPreview(review.clip ?? review.article.title),
            byline:
              review.reviewerName && review.reviewerName !== source
                ? review.reviewerName
                : undefined,
            score: review.nativeScore ?? undefined,
          },
        ],
      },
    ];
  });
  const memberItems = activity.flatMap((entry): CommunityFeedItem[] => {
    if (entry.type === "critic_review") {
      const review = entry.review;
      if (!review.bottle) return [];
      const source = review.site?.name ?? review.reviewerName ?? "Critic";
      return [
        {
          id: entry.id,
          kind: "critic_review",
          actor: source,
          actorHref: review.url,
          actorImageUrl: review.site?.imageUrl,
          action: "published a review",
          date: entry.createdAt,
          href: review.url,
          bottles: [
            {
              ...feedBottle(review.bottle),
              description: getPreview(review.clip ?? review.article.title),
              byline:
                review.reviewerName && review.reviewerName !== source
                  ? review.reviewerName
                  : undefined,
              score: review.nativeScore ?? undefined,
            },
          ],
        },
      ];
    }
    const actor = {
      actor: entry.createdBy.username,
      actorHref: `/users/${entry.createdBy.username}`,
      actorImageUrl: entry.createdBy.pictureUrl,
    };
    if (entry.type === "tasting_session") {
      return entry.tastings.map((tasting) => ({
        ...actor,
        id: `${entry.id}:${tasting.id}`,
        kind: "tasting",
        action: "tasted",
        date: tasting.createdAt,
        href: getTastingUrl(tasting),
        bottles: [
          {
            ...feedBottle(tasting.bottle),
            id: String(tasting.id),
            description: getPreview(tasting.notes),
            ratingBand: tasting.ratingBand,
          },
        ],
      }));
    }
    if (entry.type === "member_review") {
      return [
        {
          ...actor,
          id: entry.id,
          kind: "member_review",
          action: "reviewed",
          date: entry.createdAt,
          href: `/reviews/${entry.review.id}`,
          bottles: [
            {
              ...feedBottle(entry.review.bottle),
              score: { value: entry.review.score, scale: 100 },
              description: getPreview(entry.review.notes),
            },
          ],
        },
      ];
    }
    // Peated activity follows the profile rule: favorites are not feed events.
    if (entry.collection.href?.endsWith("/favorites")) return [];
    const isLibrary = entry.collection.href?.endsWith("/library");
    const destinationLabel = isLibrary
      ? "their library"
      : entry.collection.name;
    const count = entry.totalItems;
    const hiddenCount = Math.max(0, count - entry.items.length);
    return [
      {
        ...actor,
        id: entry.id,
        kind: "collection_add",
        date: entry.createdAt,
        href: entry.collection.href ?? undefined,
        action: `added ${count === 1 ? "a bottle" : `${count} bottles`} to${entry.collection.href ? "" : ` ${destinationLabel}`}`,
        destination: entry.collection.href
          ? { href: entry.collection.href, label: destinationLabel }
          : undefined,
        bottles: entry.items.map((item) => ({
          ...feedBottle(item.bottle),
          id: String(item.id),
          imageUrl: item.imageUrl ?? item.bottle.imageUrl,
        })),
        more:
          hiddenCount && entry.collection.href
            ? {
                href: entry.collection.href,
                label: `View ${hiddenCount} more ${hiddenCount === 1 ? "bottle" : "bottles"} →`,
              }
            : undefined,
      },
    ];
  });
  return [...criticItems, ...memberItems].sort(
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
