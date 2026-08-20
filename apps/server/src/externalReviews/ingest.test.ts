import { db } from "@peated/server/db";
import {
  bottleTombstones,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import { ingestReviewArticle } from "@peated/server/externalReviews/ingest";
import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";

const resolveBottleMock = vi.hoisted(() => vi.fn());
const generateSummaryMock = vi.hoisted(() => vi.fn());
const logTelemetryErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/lib/bottleReferenceResolution", () => ({
  resolveScrapedBottleReferenceTarget: resolveBottleMock,
}));

vi.mock("@peated/server/externalReviews/summary", () => ({
  generateExternalReviewSummary: generateSummaryMock,
}));

vi.mock("@peated/server/lib/log", async (importOriginal) => ({
  ...(await importOriginal()),
  logTelemetryError: logTelemetryErrorMock,
}));

function resolution(bottleId: number | null) {
  return {
    assignment:
      bottleId === null ? null : { kind: "direct_bottle" as const, bottleId },
    source: bottleId === null ? "unresolved" : "classifier_match",
    error: null,
    confidence: null,
    model: null,
    rationale: null,
    classifierEvidence: null,
    createdBottle: false,
  };
}

beforeEach(() => {
  resolveBottleMock.mockReset();
  generateSummaryMock.mockReset();
  logTelemetryErrorMock.mockReset();
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
  expect(resolveBottleMock).not.toHaveBeenCalled();
});

test("resolves each review and hides unresolved or invalid assignments", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Resolved Review Bottle" });
  const missingBottleId = 2_147_483_647;
  const unresolvedName =
    "Mister Sam Tribute Whiskey (66,9%, OB 2019 (Batch 1), 1200 btl.)";
  resolveBottleMock
    .mockResolvedValueOnce(resolution(bottle.id))
    .mockResolvedValueOnce(resolution(null))
    .mockResolvedValueOnce(resolution(missingBottleId));

  await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/spring-releases",
      title: "Three spring releases reviewed",
      contentHash: "sha256:first",
      reviews: [
        { sourceKey: "resolved", name: bottle.fullName },
        { sourceKey: "unresolved", name: unresolvedName },
        { sourceKey: "invalid", name: "Missing Review Bottle" },
      ],
    },
  });

  expect(resolveBottleMock).toHaveBeenCalledTimes(3);
  expect(await db.select().from(reviewArticles)).toHaveLength(1);
  expect(
    await db.select().from(reviews).orderBy(asc(reviews.sourceKey)),
  ).toMatchObject([
    {
      sourceKey: "invalid",
      bottleId: null,
      hidden: true,
    },
    {
      sourceKey: "resolved",
      bottleId: bottle.id,
      hidden: true,
    },
    {
      sourceKey: "unresolved",
      name: unresolvedName,
      bottleId: null,
      hidden: true,
    },
  ]);
});

test("hides an existing review when its resolved Bottle is retired", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Retired Review Bottle" });
  const replacement = await fixtures.Bottle({
    name: "Replacement Review Bottle",
  });
  resolveBottleMock.mockResolvedValue(resolution(bottle.id));
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

test("stores a generated summary without storing its source text", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Summarized Review Bottle" });
  const generatedAt = new Date("2026-04-13T12:01:00Z");
  const sourceText = "Publisher text that must remain transient.";
  resolveBottleMock.mockResolvedValue(resolution(bottle.id));
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
  resolveBottleMock.mockResolvedValue(resolution(bottle.id));
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
