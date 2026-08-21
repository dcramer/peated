import {
  normalizeReviewRating,
  ReviewArticleIngestionSchema,
  ReviewArticleObservationSchema,
} from "@peated/server/externalReviews/observation";

function observation() {
  return {
    canonicalUrl: "https://reviews.example/articles/spring-releases",
    title: "Three spring releases reviewed",
    issue: "Spring 2026",
    publishedAt: new Date("2026-04-12T12:00:00Z"),
    contentHash: "sha256:first",
    reviews: [
      {
        sourceKey: "ardbeg-ten",
        name: "Ardbeg 10-year-old",
        reviewerName: "A. Reviewer",
        nativeScore: { value: 7.8, scale: 10, display: "7.8/10" },
        normalizedRating: 78,
      },
      {
        sourceKey: "lagavulin-special",
        name: "Lagavulin Special Release",
      },
    ],
  };
}

test("parses one article with stable scored and unscored reviews", () => {
  expect(ReviewArticleObservationSchema.parse(observation())).toMatchObject({
    reviews: [
      {
        sourceKey: "ardbeg-ten",
        normalizedRating: 78,
      },
      {
        sourceKey: "lagavulin-special",
        reviewerName: null,
        nativeScore: null,
        normalizedRating: null,
      },
    ],
  });
});

test("rejects duplicate review source keys", () => {
  const input = observation();
  input.reviews[1] = {
    ...input.reviews[0],
    name: "Another bottle",
  };

  expect(() => ReviewArticleObservationSchema.parse(input)).toThrow(
    "Review source keys must be unique within an article.",
  );
});

test("normalizes a native score to an integer percentage", () => {
  expect(
    normalizeReviewRating({ value: 7.85, scale: 10, display: "7.85/10" }),
  ).toBe(79);
});

test("rejects review text without a matching source key", () => {
  expect(() =>
    ReviewArticleIngestionSchema.parse({
      article: observation(),
      reviewTexts: { missing: "Review text" },
    }),
  ).toThrow("Review text must match a review source key.");
});
