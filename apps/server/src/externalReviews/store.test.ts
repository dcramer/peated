import { db } from "@peated/server/db";
import { externalReviewDocuments, reviews } from "@peated/server/db/schema";
import { storeExternalReviewDocument } from "@peated/server/externalReviews/store";
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
    observations: [
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

describe("storeExternalReviewDocument", () => {
  test("stores one document with scored and unscored observations", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });

    const result = await storeExternalReviewDocument(inputFor(site.id));

    expect(result.observationIds).toHaveLength(2);
    expect(
      await db.query.externalReviewDocuments.findFirst({
        where: eq(externalReviewDocuments.id, result.documentId),
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
        .where(eq(reviews.documentId, result.documentId))
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

  test("updates the same document and stable observations idempotently", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const first = await storeExternalReviewDocument(inputFor(site.id));
    const refreshedInput = inputFor(site.id);
    refreshedInput.title = "Spring releases revisited";
    refreshedInput.contentHash = "sha256:second";
    refreshedInput.observations[0] = {
      ...refreshedInput.observations[0],
      reviewerName: "Another Reviewer",
      nativeScore: { value: 8.1, scale: 10, display: "8.1/10" },
      normalizedRating: 81,
    };

    const refreshed = await storeExternalReviewDocument(refreshedInput);

    expect(refreshed).toEqual(first);
    expect(await db.select().from(externalReviewDocuments)).toMatchObject([
      { id: first.documentId, title: "Spring releases revisited" },
    ]);
    expect(await db.select().from(reviews)).toHaveLength(2);
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, first.observationIds[0]),
      }),
    ).toMatchObject({
      reviewerName: "Another Reviewer",
      nativeScoreValue: 8.1,
      nativeScoreScale: 10,
      nativeScoreDisplay: "8.1/10",
      rating: 81,
    });
  });

  test("allows the same canonical URL at different sources", async ({
    fixtures,
  }) => {
    const firstSite = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondSite = await fixtures.ExternalSite({ type: "totalwine" });

    await storeExternalReviewDocument(inputFor(firstSite.id));
    await storeExternalReviewDocument(inputFor(secondSite.id));

    expect(await db.select().from(externalReviewDocuments)).toHaveLength(2);
    expect(await db.select().from(reviews)).toHaveLength(4);
  });

  test("rejects transient publisher content without persisting or echoing it", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secretBody = "publisher article body must remain transient";
    const secretNotes = "copied tasting notes must remain transient";

    const error = await waitError(
      storeExternalReviewDocument({
        ...inputFor(site.id),
        html: `<article>${secretBody}</article>`,
        body: secretBody,
        conclusion: secretBody,
        imageUrl: "https://reviews.example/publisher-photo.jpg",
        observations: inputFor(site.id).observations.map((observation) => ({
          ...observation,
          tastingNotes: secretNotes,
        })),
      }),
    );

    expect(String(error)).not.toContain(secretBody);
    expect(String(error)).not.toContain(secretNotes);
    expect(await db.select().from(externalReviewDocuments)).toHaveLength(0);
    expect(await db.select().from(reviews)).toHaveLength(0);
  });
});
