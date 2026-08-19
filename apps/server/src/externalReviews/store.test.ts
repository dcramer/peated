import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { storeReviewArticle } from "@peated/server/externalReviews/store";
import waitError from "@peated/server/lib/test/waitError";
import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

function inputFor(externalSiteId: number) {
  return {
    externalSiteId,
    canonicalUrl: "https://reviews.example/articles/spring-releases",
    title: "Three spring releases reviewed",
    issue: "Spring 2026",
    publishedAt: new Date("2026-04-12T12:00:00Z"),
    contentHash: "sha256:first",
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
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
        reviewerName: null,
        nativeScore: null,
        normalizedRating: null,
      },
    ],
  };
}

describe("storeReviewArticle", () => {
  test("stores one article with scored and unscored reviews", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });

    const result = await storeReviewArticle(inputFor(site.id));

    expect(result.reviewIds).toHaveLength(2);
    expect(
      await db.query.reviewArticles.findFirst({
        where: eq(reviewArticles.id, result.articleId),
      }),
    ).toMatchObject({
      externalSiteId: site.id,
      canonicalUrl: "https://reviews.example/articles/spring-releases",
      title: "Three spring releases reviewed",
      issue: "Spring 2026",
      contentHash: "sha256:first",
    });
    expect(
      await db
        .select()
        .from(reviews)
        .where(eq(reviews.articleId, result.articleId))
        .orderBy(asc(reviews.sourceKey)),
    ).toMatchObject([
      {
        sourceKey: "ardbeg-ten",
        name: "Ardbeg 10-year-old",
        reviewerName: "A. Reviewer",
        nativeScoreValue: 7.8,
        nativeScoreScale: 10,
        nativeScoreDisplay: "7.8/10",
        rating: 78,
        hidden: true,
      },
      {
        sourceKey: "lagavulin-special",
        name: "Lagavulin Special Release",
        reviewerName: null,
        nativeScoreValue: null,
        nativeScoreScale: null,
        nativeScoreDisplay: null,
        rating: null,
        hidden: true,
      },
    ]);
  });

  test("updates the same article and stable reviews idempotently", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const first = await storeReviewArticle(inputFor(site.id));
    const refreshedInput = inputFor(site.id);
    refreshedInput.title = "Spring releases revisited";
    refreshedInput.issue = "Summer 2026";
    refreshedInput.contentHash = "sha256:second";
    refreshedInput.reviews[0] = {
      ...refreshedInput.reviews[0],
      reviewerName: "Another Reviewer",
      nativeScore: { value: 8.1, scale: 10, display: "8.1/10" },
      normalizedRating: 81,
    };

    const refreshed = await storeReviewArticle(refreshedInput);

    expect(refreshed).toEqual(first);
    expect(await db.select().from(reviewArticles)).toMatchObject([
      { id: first.articleId, title: "Spring releases revisited" },
    ]);
    expect(await db.select().from(reviews)).toHaveLength(2);
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, first.reviewIds[0]),
      }),
    ).toMatchObject({
      reviewerName: "Another Reviewer",
      nativeScoreValue: 8.1,
      nativeScoreScale: 10,
      nativeScoreDisplay: "8.1/10",
      rating: 81,
      issue: "Summer 2026",
      url: "https://reviews.example/articles/spring-releases",
    });
  });

  test("uses article identity instead of legacy review identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondArticle = inputFor(site.id);
    secondArticle.canonicalUrl =
      "https://reviews.example/articles/more-spring-releases";

    await storeReviewArticle(inputFor(site.id));
    await storeReviewArticle(secondArticle);

    expect(await db.select().from(reviewArticles)).toHaveLength(2);
    expect(await db.select().from(reviews)).toHaveLength(4);
  });

  test("preserves legacy URL identity during the article cutover", async ({
    fixtures,
  }) => {
    const firstSite = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondSite = await fixtures.ExternalSite({ type: "totalwine" });
    const url = "https://reviews.example/reviews/shared-url";

    await db.insert(reviews).values([
      {
        externalSiteId: firstSite.id,
        name: "First legacy review",
        issue: "First issue",
        rating: 90,
        url,
      },
      {
        externalSiteId: secondSite.id,
        name: "Second-site legacy review",
        issue: "Second issue",
        rating: 91,
        url,
      },
    ]);

    await waitError(
      db.insert(reviews).values({
        externalSiteId: firstSite.id,
        name: "Duplicate legacy review",
        issue: "Different issue",
        rating: 92,
        url,
      }),
    );
    expect(await db.select().from(reviews)).toHaveLength(2);
  });

  test("allows the same canonical URL at different sources", async ({
    fixtures,
  }) => {
    const firstSite = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondSite = await fixtures.ExternalSite({ type: "totalwine" });

    await storeReviewArticle(inputFor(firstSite.id));
    await storeReviewArticle(inputFor(secondSite.id));

    expect(await db.select().from(reviewArticles)).toHaveLength(2);
    expect(await db.select().from(reviews)).toHaveLength(4);
  });

  test("rejects transient publisher content without persisting or echoing it", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secretBody = "publisher article body must remain transient";
    const secretNotes = "copied tasting notes must remain transient";

    const error = await waitError(
      storeReviewArticle({
        ...inputFor(site.id),
        html: `<article>${secretBody}</article>`,
        body: secretBody,
        conclusion: secretBody,
        imageUrl: "https://reviews.example/publisher-photo.jpg",
        reviews: inputFor(site.id).reviews.map((review) => ({
          ...review,
          tastingNotes: secretNotes,
        })),
      }),
    );

    expect(String(error)).not.toContain(secretBody);
    expect(String(error)).not.toContain(secretNotes);
    expect(await db.select().from(reviewArticles)).toHaveLength(0);
    expect(await db.select().from(reviews)).toHaveLength(0);
  });
});
