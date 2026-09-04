import {
  mockActivity,
  mockExternalReview,
  mockTasting,
} from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getCommunityFeedItems } from "./communityFeed";
import { getTastingUrl } from "./urls";

const session = mockActivity.find((item) => item.type === "tasting_session")!;

describe("getCommunityFeedItems", () => {
  test("uses the review clip as the preview", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [mockExternalReview],
      activity: [],
    });

    expect(item?.bottles[0]?.description).toBe(mockExternalReview.clip);
    expect(item?.actorHref).toBe(mockExternalReview.url);
    expect(item?.href).toBe(mockExternalReview.url);
  });

  test("maps critic reviews returned as paginated activity", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [],
      activity: [
        {
          id: `critic_review:${mockExternalReview.id}`,
          type: "critic_review",
          priority: "primary",
          createdAt: mockExternalReview.article.publishedAt!,
          review: mockExternalReview,
        },
      ],
    });

    expect(item).toMatchObject({
      kind: "critic_review",
      actor: mockExternalReview.site?.name,
      actorHref: mockExternalReview.url,
      href: mockExternalReview.url,
      bottles: [
        {
          description: mockExternalReview.clip,
        },
      ],
    });
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
    expect(items.map((item) => item.href)).toEqual([
      mockExternalReview.url,
      `/tastings/${mockTasting.id}-example-barrel-proof`,
    ]);
  });

  test("keeps original score scales separate from tasting ratings", () => {
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
      { value: 0, scale: 100, display: "0" },
      { value: 9, scale: 10, display: "9/10" },
      undefined,
    ]);
    expect(items[2]?.bottles[0]?.ratingBand).toBe(mockTasting.ratingBand);
  });
});

test("includes all four activity types, makes one card per tasting, and omits library status", () => {
  const items = getCommunityFeedItems({
    activity: mockActivity,
    criticReviews: [mockExternalReview],
  });
  expect(new Set(items.map((item) => item.kind))).toEqual(
    new Set(["tasting", "critic_review", "member_review", "collection_add"]),
  );
  const tastings = items.filter((item) => item.kind === "tasting");
  expect(tastings).toHaveLength(
    mockActivity
      .filter((item) => item.type === "tasting_session")
      .reduce((total, item) => total + item.tastings.length, 0),
  );
  expect(tastings.every((item) => item.bottles.length === 1)).toBe(true);
  expect(tastings.map((item) => item.href)).toEqual(
    expect.arrayContaining(
      session.tastings.map((tasting) => getTastingUrl(tasting)),
    ),
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
