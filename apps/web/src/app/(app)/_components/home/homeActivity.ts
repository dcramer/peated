import type { CommunityFeedItem } from "@peated/web/components/communityFeed.stylex";

const HOME_ACTIVITY_LIMIT = 5;

/** Homepage rule: represent both critic reviews and community activity when available. */
export function selectHomeActivityItems(
  items: readonly CommunityFeedItem[],
): CommunityFeedItem[] {
  const ordered = [...items].sort(
    (left, right) => Date.parse(right.date) - Date.parse(left.date),
  );
  const selected = ordered.slice(0, HOME_ACTIVITY_LIMIT);

  if (selected.length < 2) return selected;

  const missingItem = selected.every((item) => item.kind === "critic_review")
    ? ordered.find((item) => item.kind !== "critic_review")
    : selected.every((item) => item.kind !== "critic_review")
      ? ordered.find((item) => item.kind === "critic_review")
      : undefined;

  if (!missingItem) return selected;

  return [...selected.slice(0, -1), missingItem].sort(
    (left, right) => Date.parse(right.date) - Date.parse(left.date),
  );
}
