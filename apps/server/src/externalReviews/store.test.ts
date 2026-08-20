import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { storeReviewArticle } from "@peated/server/externalReviews/store";
import waitError from "@peated/server/lib/test/waitError";
import { asc, eq } from "drizzle-orm";
import pg from "pg";
import { describe, expect, test } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for external review source lock.");
}

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

  test("publishes only resolved reviews in automatic mode", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
      allowFetching: true,
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
    const bottle = await fixtures.Bottle({ name: "Resolved Review Bottle" });
    const input = inputFor(site.id);

    await storeReviewArticle({
      ...input,
      reviews: [
        { ...input.reviews[0], bottleId: bottle.id },
        { ...input.reviews[1], bottleId: null },
      ],
    });

    expect(
      await db
        .select({ sourceKey: reviews.sourceKey, hidden: reviews.hidden })
        .from(reviews)
        .orderBy(asc(reviews.sourceKey)),
    ).toEqual([
      { sourceKey: "ardbeg-ten", hidden: false },
      { sourceKey: "lagavulin-special", hidden: true },
    ]);
  });

  test("publishes a newly resolved review but preserves a moderator hide", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
      allowFetching: true,
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
    const bottle = await fixtures.Bottle({ name: "Resolved Review Bottle" });
    const input = inputFor(site.id);

    await storeReviewArticle({
      ...input,
      reviews: [{ ...input.reviews[0], bottleId: null }],
    });
    await storeReviewArticle({
      ...input,
      reviews: [{ ...input.reviews[0], bottleId: bottle.id }],
    });
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.sourceKey, "ardbeg-ten"),
    });
    expect(review).toMatchObject({ bottleId: bottle.id, hidden: false });

    await db
      .update(reviews)
      .set({ hidden: true })
      .where(eq(reviews.id, review!.id));
    await storeReviewArticle({
      ...input,
      reviews: [{ ...input.reviews[0], bottleId: bottle.id }],
    });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review!.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, hidden: true });
  });

  test("serializes publication policy changes with article ingestion", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "review_only",
      allowFetching: true,
      allowLlmProcessing: true,
      allowScoreDisplay: true,
      allowSummaryDisplay: true,
    });
    const bottle = await fixtures.Bottle({ name: "Concurrent Review Bottle" });
    const input = inputFor(site.id);
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let ingestion: ReturnType<typeof storeReviewArticle> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `SELECT "id" FROM "external_site" WHERE "id" = $1 FOR UPDATE`,
        [site.id],
      );
      ingestion = storeReviewArticle({
        ...input,
        reviews: [{ ...input.reviews[0], bottleId: bottle.id }],
      });
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query(
        `UPDATE "external_review_source_policy"
         SET "publication_mode" = 'automatic'
         WHERE "external_site_id" = $1`,
        [site.id],
      );
      await client.query("COMMIT");
      committed = true;
      await ingestion;

      expect(
        await db.query.reviews.findFirst({
          where: eq(reviews.sourceKey, "ardbeg-ten"),
        }),
      ).toMatchObject({ bottleId: bottle.id, hidden: false });
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await ingestion?.catch(() => undefined);
    }
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
      {
        id: first.articleId,
        title: "Spring releases revisited",
        issue: "Summer 2026",
        canonicalUrl: "https://reviews.example/articles/spring-releases",
      },
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
    });
  });

  test("keeps a current summary and clears it after the article changes", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const generatedAt = new Date("2026-04-13T12:01:00Z");
    const firstInput = inputFor(site.id);
    await storeReviewArticle({
      ...firstInput,
      reviews: firstInput.reviews.map((review, index) => ({
        ...review,
        summary:
          index === 0
            ? {
                text: "The reviewer finds this whisky bright. They note a dry finish.",
                contentHash: "sha256:first",
                model: "gpt-5.4-2026-08-01",
                promptVersion: "external-review-summary-v1",
                generatedAt,
              }
            : null,
      })),
    });

    await storeReviewArticle(inputFor(site.id));
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.sourceKey, "ardbeg-ten"),
      }),
    ).toMatchObject({
      summary: "The reviewer finds this whisky bright. They note a dry finish.",
      summaryContentHash: "sha256:first",
    });

    const changedInput = inputFor(site.id);
    changedInput.contentHash = "sha256:second";
    await storeReviewArticle(changedInput);

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.sourceKey, "ardbeg-ten"),
      }),
    ).toMatchObject({
      summary: null,
      summaryContentHash: null,
      summaryModel: null,
      summaryPromptVersion: null,
      summaryGeneratedAt: null,
    });
  });

  test("uses article identity for stable reviews", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondArticle = inputFor(site.id);
    secondArticle.canonicalUrl =
      "https://reviews.example/articles/more-spring-releases";

    await storeReviewArticle(inputFor(site.id));
    await storeReviewArticle(secondArticle);

    expect(await db.select().from(reviewArticles)).toHaveLength(2);
    expect(await db.select().from(reviews)).toHaveLength(4);
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
