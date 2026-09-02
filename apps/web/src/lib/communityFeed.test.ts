import { mockExternalReview } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, test } from "vitest";

import { getCommunityFeedItems } from "./communityFeed";

describe("getCommunityFeedItems", () => {
  test("uses the review clip as the preview", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [mockExternalReview],
      memberTastings: [],
    });

    expect(item?.description).toBe(mockExternalReview.clip);
  });

  test("uses the article title when the review has no clip", () => {
    const [item] = getCommunityFeedItems({
      criticReviews: [{ ...mockExternalReview, clip: null }],
      memberTastings: [],
    });

    expect(item?.description).toBe(mockExternalReview.article.title);
  });
});
