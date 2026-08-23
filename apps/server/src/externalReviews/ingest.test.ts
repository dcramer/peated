import { db } from "@peated/server/db";
import {
  bottleTombstones,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import {
  ingestReviewArticle as ingestReviewArticleWithServices,
  type ReviewIngestionServices,
} from "@peated/server/externalReviews/ingest";
import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";

const generateSummaryMock = vi.fn<ReviewIngestionServices["generateSummary"]>();
const logTelemetryErrorMock = vi.fn<ReviewIngestionServices["reportError"]>();
const pushUniqueJobMock =
  vi.fn<ReviewIngestionServices["queueMissingBottles"]>();
const services: ReviewIngestionServices = {
  generateSummary: generateSummaryMock,
  queueMissingBottles: pushUniqueJobMock,
  reportError: logTelemetryErrorMock,
};

function ingestReviewArticle(
  input: Parameters<typeof ingestReviewArticleWithServices>[0],
) {
  return ingestReviewArticleWithServices(input, services);
}

beforeEach(() => {
  generateSummaryMock.mockReset();
  logTelemetryErrorMock.mockReset();
  pushUniqueJobMock.mockReset();
});

test("rejects a missing source before Bottle resolution", async () => {
  const externalSiteId = 2_147_483_647;

  await expect(
    ingestReviewArticle({
      externalSiteId,
      fetchedAt: new Date("2026-04-13T12:00:00Z"),
      article: {
        canonicalUrl: "https://reviews.example/articles/missing-source",
        title: "Missing source review",
        contentHash: "sha256:missing-source",
        reviews: [{ sourceKey: "review", name: "Review Bottle" }],
      },
    }),
  ).rejects.toThrow(`External site ${externalSiteId} not found.`);
  expect(pushUniqueJobMock).not.toHaveBeenCalled();
});

test("stores exact aliases and queues model resolution after storage", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Resolved Review Bottle" });
  const unresolvedName =
    "Mister Sam Tribute Whiskey (66,9%, OB 2019 (Batch 1), 1200 btl.)";

  const result = await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/spring-releases",
      title: "Three spring releases reviewed",
      contentHash: "sha256:first",
      reviews: [
        { sourceKey: "resolved", name: bottle.fullName },
        {
          sourceKey: "unresolved",
          name: unresolvedName,
          category: "single_malt",
        },
      ],
    },
  });

  expect(await db.select().from(reviewArticles)).toHaveLength(1);
  expect(
    await db.select().from(reviews).orderBy(asc(reviews.sourceKey)),
  ).toMatchObject([
    {
      sourceKey: "resolved",
      bottleId: bottle.id,
      hidden: true,
    },
    {
      sourceKey: "unresolved",
      name: unresolvedName,
      category: "single_malt",
      bottleId: null,
      hidden: true,
    },
  ]);
  expect(pushUniqueJobMock).toHaveBeenCalledWith(
    "CreateMissingBottles",
    { articleId: result.articleId },
    { removeOnComplete: true, removeOnFail: true },
  );
});

test("hides an existing review when its resolved Bottle is retired", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Retired Review Bottle" });
  const replacement = await fixtures.Bottle({
    name: "Replacement Review Bottle",
  });
  const input = {
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/retired-bottle",
      title: "A retired Bottle review",
      contentHash: "sha256:retired",
      reviews: [{ sourceKey: "retired", name: bottle.fullName }],
    },
  };

  await ingestReviewArticle(input);
  await db
    .update(reviews)
    .set({ hidden: false })
    .where(eq(reviews.sourceKey, "retired"));
  await db.insert(bottleTombstones).values({
    bottleId: bottle.id,
    newBottleId: replacement.id,
  });

  await ingestReviewArticle(input);

  expect(
    await db.query.reviews.findFirst({
      where: eq(reviews.sourceKey, "retired"),
    }),
  ).toMatchObject({
    bottleId: bottle.id,
    hidden: true,
  });
});

test("keeps stored reviews when background dispatch fails", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const queueError = new Error("queue unavailable");
  pushUniqueJobMock.mockRejectedValue(queueError);

  const result = await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/queued-later",
      title: "A review queued later",
      contentHash: "sha256:queued-later",
      reviews: [{ sourceKey: "queued-later", name: "Unknown Bottle" }],
    },
  });

  expect(await db.query.reviews.findFirst()).toMatchObject({
    articleId: result.articleId,
    bottleId: null,
  });
  expect(logTelemetryErrorMock).toHaveBeenCalledWith(queueError, {
    extra: {
      reviewArticleId: result.articleId,
      externalSiteId: site.id,
    },
  });
});

test("stores a generated summary without storing its source text", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Summarized Review Bottle" });
  const generatedAt = new Date("2026-04-13T12:01:00Z");
  const sourceText = "Publisher text that must remain transient.";
  generateSummaryMock.mockResolvedValue({
    text: "The reviewer finds the whisky balanced. They recommend it for its dry finish.",
    contentHash: "sha256:summary",
    model: "gpt-5.4-2026-08-01",
    promptVersion: "external-review-summary-v1",
    generatedAt,
  });

  await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/summary",
      title: "A summarized review",
      contentHash: "sha256:summary",
      reviews: [{ sourceKey: "summary", name: bottle.fullName }],
    },
    reviewTexts: { summary: sourceText },
  });

  expect(await db.query.reviews.findFirst()).toMatchObject({
    summary:
      "The reviewer finds the whisky balanced. They recommend it for its dry finish.",
    summaryContentHash: "sha256:summary",
    summaryModel: "gpt-5.4-2026-08-01",
    summaryPromptVersion: "external-review-summary-v1",
    summaryGeneratedAt: generatedAt,
  });
  expect(JSON.stringify(await db.query.reviews.findFirst())).not.toContain(
    sourceText,
  );
});

test("stores review metadata when summary generation fails", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Summary Failure Bottle" });
  const sourceText = "Publisher text that must not enter the failure log.";
  generateSummaryMock.mockRejectedValue(new Error(sourceText));

  await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/summary-failure",
      title: "A review with a failed summary",
      contentHash: "sha256:failure",
      reviews: [{ sourceKey: "failure", name: bottle.fullName }],
    },
    reviewTexts: { failure: sourceText },
  });

  expect(await db.query.reviews.findFirst()).toMatchObject({
    bottleId: bottle.id,
    sourceKey: "failure",
    summary: null,
  });
  expect(logTelemetryErrorMock).toHaveBeenCalledWith(
    "Unable to generate external review summary.",
    {
      extra: {
        review: {
          externalSiteId: site.id,
          sourceKey: "failure",
          url: "https://reviews.example/articles/summary-failure",
        },
      },
    },
  );
  expect(JSON.stringify(logTelemetryErrorMock.mock.calls)).not.toContain(
    sourceText,
  );
});
