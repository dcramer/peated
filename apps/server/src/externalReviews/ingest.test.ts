import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import {
  ingestExternalReviewArticle as ingestExternalReviewArticleWithServices,
  type ExternalReviewIngestionServices,
} from "@peated/server/externalReviews/ingest";
import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";

const generateSummaryMock =
  vi.fn<ExternalReviewIngestionServices["generateSummary"]>();
const logTelemetryErrorMock =
  vi.fn<ExternalReviewIngestionServices["reportError"]>();
const pushUniqueJobMock =
  vi.fn<ExternalReviewIngestionServices["queueMissingBottles"]>();
const services: ExternalReviewIngestionServices = {
  generateSummary: generateSummaryMock,
  queueMissingBottles: pushUniqueJobMock,
  reportError: logTelemetryErrorMock,
};

function ingestExternalReviewArticle(
  input: Parameters<typeof ingestExternalReviewArticleWithServices>[0],
) {
  return ingestExternalReviewArticleWithServices(input, services);
}

beforeEach(() => {
  generateSummaryMock.mockReset();
  logTelemetryErrorMock.mockReset();
  pushUniqueJobMock.mockReset();
});

test("rejects a missing source before Bottle resolution", async () => {
  const externalSiteId = 2_147_483_647;

  await expect(
    ingestExternalReviewArticle({
      externalSiteId,
      fetchedAt: new Date("2026-04-13T12:00:00Z"),
      article: {
        canonicalUrl: "https://reviews.example/articles/missing-source",
        title: "Missing source review",
        contentHash: "sha256:missing-source",
        externalReviews: [{ sourceKey: "review", name: "Review Bottle" }],
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

  const result = await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/spring-releases",
      title: "Three spring releases reviewed",
      contentHash: "sha256:first",
      externalReviews: [
        { sourceKey: "resolved", name: bottle.fullName },
        {
          sourceKey: "unresolved",
          name: unresolvedName,
          category: "single_malt",
        },
      ],
    },
  });

  expect(await db.select().from(externalReviewArticles)).toHaveLength(1);
  expect(
    await db
      .select()
      .from(externalReviews)
      .orderBy(asc(externalReviews.sourceKey)),
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
      externalReviews: [{ sourceKey: "retired", name: bottle.fullName }],
    },
  };

  await ingestExternalReviewArticle(input);
  await db
    .update(externalReviews)
    .set({ hidden: false })
    .where(eq(externalReviews.sourceKey, "retired"));
  await db.insert(bottleTombstones).values({
    bottleId: bottle.id,
    newBottleId: replacement.id,
  });

  await ingestExternalReviewArticle(input);

  expect(
    await db.query.externalReviews.findFirst({
      where: eq(externalReviews.sourceKey, "retired"),
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

  const result = await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/queued-later",
      title: "A review queued later",
      contentHash: "sha256:queued-later",
      externalReviews: [{ sourceKey: "queued-later", name: "Unknown Bottle" }],
    },
  });

  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    articleId: result.articleId,
    bottleId: null,
  });
  expect(logTelemetryErrorMock).toHaveBeenCalledWith(queueError, {
    extra: {
      externalReviewArticleId: result.articleId,
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

  await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/summary",
      title: "A summarized review",
      contentHash: "sha256:summary",
      externalReviews: [{ sourceKey: "summary", name: bottle.fullName }],
    },
    externalReviewTexts: { summary: sourceText },
  });

  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    summary:
      "The reviewer finds the whisky balanced. They recommend it for its dry finish.",
    summaryContentHash: "sha256:summary",
    summaryModel: "gpt-5.4-2026-08-01",
    summaryPromptVersion: "external-review-summary-v1",
    summaryGeneratedAt: generatedAt,
  });
  expect(
    JSON.stringify(await db.query.externalReviews.findFirst()),
  ).not.toContain(sourceText);
});

test("stores review metadata when summary generation fails", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Summary Failure Bottle" });
  const sourceText = "Publisher text that must not enter the failure log.";
  generateSummaryMock.mockRejectedValue(new Error(sourceText));

  await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/summary-failure",
      title: "A review with a failed summary",
      contentHash: "sha256:failure",
      externalReviews: [{ sourceKey: "failure", name: bottle.fullName }],
    },
    externalReviewTexts: { failure: sourceText },
  });

  expect(await db.query.externalReviews.findFirst()).toMatchObject({
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
