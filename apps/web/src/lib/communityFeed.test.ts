import {
  mockActivity,
  mockExternalReview,
  mockTasting,
} from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getCommunityFeedItems } from "./communityFeed";

const session = mockActivity.find((item) => item.type === "tasting_session")!;

describe("getCommunityFeedItems", () => {
  test("uses the review clip as the preview", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [mockExternalReview],
      activity: [],
    });

    expect(item?.bottles[0]?.description).toBe(mockExternalReview.clip);
    expect(item?.actorHref).toBe(mockExternalReview.url);
  });

  test("uses the article title when the review has no clip", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [{ ...mockExternalReview, clip: null }],
      activity: [],
    });

    expect(item?.bottles[0]?.description).toBe(
      mockExternalReview.article.title,
    );
  });

  test("uses concise bottle identity for both review and tasting links", () => {
    const bottle = {
      ...mockTasting.bottle,
      name: "Barrel Proof - 12-year-old - 60.0% ABV",
      brand: { ...mockTasting.bottle.brand, name: "Example", shortName: null },
      group: undefined,
      series: null,
      edition: "Batch C923",
      statedAge: 12,
      abv: 60,
    };
    const items = getCommunityFeedItems({
      criticReviews: [{ ...mockExternalReview, bottle }],
      activity: [{ ...session, tastings: [{ ...mockTasting, bottle }] }],
    });

    expect(items.map((item) => item.bottles[0]?.name)).toEqual([
      "Example Barrel Proof",
      "Example Barrel Proof",
    ]);
    expect(
      items.every((item) => item.bottles[0]?.metadata?.includes("Batch C923")),
    ).toBe(true);
    expect(items.map((item) => item.bottles[0]?.activityHref)).toEqual([
      mockExternalReview.url,
      `/tastings/${mockTasting.id}`,
    ]);
  });

  test("keeps scores separate from tasting ratings and omits other score scales", () => {
    const items = getCommunityFeedItems({
      criticReviews: [
        {
          ...mockExternalReview,
          nativeScore: { value: 0, scale: 100, display: "0" },
        },
        {
          ...mockExternalReview,
          id: 2,
          nativeScore: { value: 9, scale: 10, display: "9/10" },
        },
      ],
      activity: [{ ...session, tastings: [mockTasting] }],
    });

    expect(items.map((item) => item.bottles[0]?.score)).toEqual([
      0,
      undefined,
      undefined,
    ]);
    expect(items[2]?.bottles[0]?.ratingBand).toBe(mockTasting.ratingBand);
  });
});

test("includes all four activity types, preserves groups, and omits library status", () => {
  const items = getCommunityFeedItems({
    activity: mockActivity,
    criticReviews: [mockExternalReview],
  });
  expect(new Set(items.map((item) => item.kind))).toEqual(
    new Set(["tasting", "critic_review", "member_review", "collection_add"]),
  );
  expect(items.find((item) => item.id === session.id)?.bottles).toHaveLength(
    session.tastings.length,
  );
  const additions = items.filter((item) => item.kind === "collection_add");
  expect(additions.map((item) => item.bottles.length)).toEqual([1, 3]);
  for (const item of additions) {
    expect(item.destination?.href).toMatch(/\/library$/);
    expect(
      item.bottles.every(
        (bottle) => !("status" in bottle) && !("isLibrary" in bottle),
      ),
    ).toBe(true);
  }
  const dates = items.map((item) => Date.parse(item.date));
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});

test.each([null, "Whisky Advocate", "Alex Sample"])(
  "critic byline is optional and does not repeat the publication: %s",
  (reviewerName) => {
    const [item] = getCommunityFeedItems({
      activity: [],
      criticReviews: [
        {
          ...mockExternalReview,
          site: { ...mockExternalReview.site!, name: "Whisky Advocate" },
          reviewerName,
        },
      ],
    });
    expect(item?.actor).toBe("Whisky Advocate");
    expect(item?.bottles[0]?.byline).toBe(
      reviewerName === "Alex Sample" ? reviewerName : undefined,
    );
  },
);

test("does not show favorites as library additions", () => {
  const addition = mockActivity.find((item) => item.type === "collection_add")!;
  const items = getCommunityFeedItems({
    criticReviews: [],
    activity: [
      {
        ...addition,
        collection: {
          ...addition.collection,
          href: "/users/someone/favorites",
        },
      },
    ],
  });
  expect(items).toEqual([]);
});
