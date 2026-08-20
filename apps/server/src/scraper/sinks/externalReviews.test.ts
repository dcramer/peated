import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { whiskyAdvocateReviewSink } from "./externalReviews";

test("Whisky Advocate observations use article and source identity", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.ExternalReviewSourcePolicy({
    externalSiteId: site.id,
    publicationMode: "review_only",
    allowFetching: true,
    allowLlmProcessing: true,
    allowScoreDisplay: true,
    allowSummaryDisplay: false,
  });
  const bottle = await fixtures.Bottle({ name: "Sink Review Bottle" });
  const url = "https://whiskyadvocate.com/reviews/sink-review";
  const observation = {
    sourceKey: "whisky-advocate-review-123",
    value: {
      name: bottle.fullName,
      category: bottle.category,
      rating: 92,
      url,
      issue: "Fall 2026",
    },
  };

  await whiskyAdvocateReviewSink({ externalSiteId: site.id, observation });
  await whiskyAdvocateReviewSink({
    externalSiteId: site.id,
    observation: {
      ...observation,
      value: { ...observation.value, rating: 93 },
    },
  });

  const storedReviews = await db
    .select({ review: reviews })
    .from(reviews)
    .innerJoin(reviewArticles, eq(reviews.articleId, reviewArticles.id))
    .where(eq(reviewArticles.externalSiteId, site.id));
  expect(storedReviews.map(({ review }) => review)).toMatchObject([
    {
      articleId: expect.any(Number),
      bottleId: bottle.id,
      name: bottle.fullName,
      rating: 93,
      nativeScoreValue: 93,
      nativeScoreScale: 100,
      nativeScoreDisplay: "93/100",
      sourceKey: observation.sourceKey,
      hidden: true,
    },
  ]);
  expect(
    await db
      .select()
      .from(reviewArticles)
      .where(
        and(
          eq(reviewArticles.externalSiteId, site.id),
          eq(reviewArticles.canonicalUrl, url),
        ),
      ),
  ).toMatchObject([
    {
      id: storedReviews[0]!.review.articleId,
      issue: "Fall 2026",
      title: bottle.fullName,
      contentHash: expect.any(String),
      fetchedAt: expect.any(Date),
    },
  ]);
});
