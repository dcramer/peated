import type { CommunityFeedItem } from "@peated/web/components/communityFeed.stylex";
import { expect, test } from "vitest";
import { selectHomeActivityItems } from "./homeActivity";

function activityItem({
  id,
  kind,
  hour,
}: {
  id: string;
  kind: CommunityFeedItem["kind"];
  hour: number;
}): CommunityFeedItem {
  return {
    id,
    kind,
    actor: "Member",
    action: "added activity",
    date: `2026-09-05T${String(hour).padStart(2, "0")}:00:00.000Z`,
    bottles: [],
  };
}

test("shows the newest five when critic and community activity are represented", () => {
  const items = [
    activityItem({ id: "community-6", kind: "tasting", hour: 6 }),
    activityItem({ id: "critic-5", kind: "critic_review", hour: 5 }),
    activityItem({ id: "community-4", kind: "member_review", hour: 4 }),
    activityItem({ id: "community-3", kind: "collection_add", hour: 3 }),
    activityItem({ id: "critic-2", kind: "critic_review", hour: 2 }),
    activityItem({ id: "community-1", kind: "tasting", hour: 1 }),
  ];

  expect(selectHomeActivityItems(items).map((item) => item.id)).toEqual([
    "community-6",
    "critic-5",
    "community-4",
    "community-3",
    "critic-2",
  ]);
});

test("includes the newest community item when critic reviews fill the newest five", () => {
  const items = [
    ...[6, 5, 4, 3, 2].map((hour) =>
      activityItem({ id: `critic-${hour}`, kind: "critic_review", hour }),
    ),
    activityItem({ id: "community-1", kind: "tasting", hour: 1 }),
  ];

  expect(selectHomeActivityItems(items).map((item) => item.id)).toEqual([
    "critic-6",
    "critic-5",
    "critic-4",
    "critic-3",
    "community-1",
  ]);
});

test("includes the newest critic review when community activity fills the newest five", () => {
  const items = [
    ...[6, 5, 4, 3, 2].map((hour) =>
      activityItem({ id: `community-${hour}`, kind: "tasting", hour }),
    ),
    activityItem({ id: "critic-1", kind: "critic_review", hour: 1 }),
  ];

  expect(selectHomeActivityItems(items).map((item) => item.id)).toEqual([
    "community-6",
    "community-5",
    "community-4",
    "community-3",
    "critic-1",
  ]);
});
