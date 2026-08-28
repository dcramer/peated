import {
  ExternalReviewArticleIngestionSchema,
  ExternalReviewArticleObservationSchema,
} from "@peated/server/externalReviews/observation";

function observation() {
  return {
    canonicalUrl: "https://reviews.example/articles/spring-releases",
    title: "Three spring releases reviewed",
    issue: "Spring 2026",
    publishedAt: new Date("2026-04-12T12:00:00Z"),
    contentHash: "sha256:first",
    externalReviews: [
      {
        sourceKey: "ardbeg-ten",
        name: "Ardbeg 10-year-old",
        reviewerName: "A. Reviewer",
        nativeScore: { value: 7.8, scale: 10, display: "7.8/10" },
      },
      {
        sourceKey: "lagavulin-special",
        name: "Lagavulin Special Release",
      },
    ],
  };
}

test("parses one article with stable scored and unscored reviews", () => {
  expect(
    ExternalReviewArticleObservationSchema.parse(observation()),
  ).toMatchObject({
    externalReviews: [
      {
        sourceKey: "ardbeg-ten",
      },
      {
        sourceKey: "lagavulin-special",
        reviewerName: null,
        nativeScore: null,
      },
    ],
  });
});

test("rejects duplicate review source keys", () => {
  const input = observation();
  input.externalReviews[1] = {
    ...input.externalReviews[0],
    name: "Another bottle",
  };

  expect(() => ExternalReviewArticleObservationSchema.parse(input)).toThrow(
    "External review source keys must be unique within an article.",
  );
});

test("rejects review text without a matching source key", () => {
  expect(() =>
    ExternalReviewArticleIngestionSchema.parse({
      article: observation(),
      externalReviewTexts: { missing: "Review text" },
    }),
  ).toThrow("External review text must match an external review source key.");
});
