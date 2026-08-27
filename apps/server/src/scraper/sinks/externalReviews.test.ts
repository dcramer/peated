import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { externalReviewSink } from "./externalReviews";

test("Whisky Advocate observations use article and source identity", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.ExternalReviewSourcePolicy({
    externalSiteId: site.id,
    publicationMode: "review_only",
    allowLlmProcessing: true,
    allowScoreDisplay: true,
    allowSummaryDisplay: false,
  });
  const bottle = await fixtures.Bottle({ name: "Sink Review Bottle" });
  const url = "https://whiskyadvocate.com/reviews/sink-review";
  const observation = {
    sourceKey: url,
    value: {
      article: {
        canonicalUrl: url,
        title: bottle.fullName,
        issue: "Fall 2026",
        publishedAt: null,
        contentHash: "first",
        externalReviews: [
          {
            sourceKey: url,
            name: bottle.fullName,
            category: bottle.category,
            reviewerName: null,
            nativeScore: { value: 92, scale: 100, display: "92/100" },
          },
        ],
      },
      externalReviewTexts: {},
    },
  };

  await externalReviewSink({ externalSiteId: site.id, observation });
  await externalReviewSink({
    externalSiteId: site.id,
    observation: {
      ...observation,
      value: {
        ...observation.value,
        article: {
          ...observation.value.article,
          contentHash: "second",
          externalReviews: [
            {
              ...observation.value.article.externalReviews[0],
              nativeScore: {
                value: 93.5,
                scale: 100,
                display: "93.5/100",
              },
            },
          ],
        },
      },
    },
  });

  const storedExternalReviews = await db
    .select({ externalReview: externalReviews })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .where(eq(externalReviewArticles.externalSiteId, site.id));
  expect(
    storedExternalReviews.map(({ externalReview }) => externalReview),
  ).toMatchObject([
    {
      articleId: expect.any(Number),
      bottleId: bottle.id,
      name: bottle.fullName,
      legacyNormalizedScore: null,
      nativeScoreValue: 93.5,
      nativeScoreScale: 100,
      nativeScoreDisplay: "93.5/100",
      sourceKey: url,
      hidden: true,
    },
  ]);
  expect(
    await db
      .select()
      .from(externalReviewArticles)
      .where(
        and(
          eq(externalReviewArticles.externalSiteId, site.id),
          eq(externalReviewArticles.canonicalUrl, url),
        ),
      ),
  ).toMatchObject([
    {
      id: storedExternalReviews[0]!.externalReview.articleId,
      issue: "Fall 2026",
      title: bottle.fullName,
      contentHash: expect.any(String),
      fetchedAt: expect.any(Date),
    },
  ]);
});
