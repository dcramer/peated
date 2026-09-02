import {
  mockExternalReview,
  mockTasting,
} from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getCommunityFeedItems } from "./communityFeed";

describe("getCommunityFeedItems", () => {
  test("uses the review clip as the preview", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [mockExternalReview],
      memberTastings: [],
    });

    expect(item?.description).toBe(mockExternalReview.clip);
    expect(item?.actorHref).toBe(mockExternalReview.url);
  });

  test("uses the article title when the review has no clip", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [{ ...mockExternalReview, clip: null }],
      memberTastings: [],
    });

    expect(item?.description).toBe(mockExternalReview.article.title);
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
      memberTastings: [{ ...mockTasting, bottle }],
    });

    expect(items.map((item) => item.title)).toEqual([
      "Example Barrel Proof",
      "Example Barrel Proof",
    ]);
    expect(items.every((item) => item.metadata?.includes("Batch C923"))).toBe(
      true,
    );
    expect(items.map((item) => item.href)).toEqual([
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
      memberTastings: [mockTasting],
    });

    expect(items.map((item) => item.score)).toEqual([0, undefined, undefined]);
    expect(items[2]?.ratingBand).toBe(mockTasting.ratingBand);
  });
});
