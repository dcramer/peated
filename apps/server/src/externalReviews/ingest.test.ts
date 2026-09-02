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

const createReviewClipMock =
  vi.fn<ExternalReviewIngestionServices["createClip"]>();
const logTelemetryErrorMock =
  vi.fn<ExternalReviewIngestionServices["reportError"]>();
const pushUniqueJobMock =
  vi.fn<ExternalReviewIngestionServices["queueMissingBottles"]>();
const services: ExternalReviewIngestionServices = {
  createClip: createReviewClipMock,
  queueMissingBottles: pushUniqueJobMock,
  reportError: logTelemetryErrorMock,
};

function ingestExternalReviewArticle(
  input: Parameters<typeof ingestExternalReviewArticleWithServices>[0],
) {
  return ingestExternalReviewArticleWithServices(input, services);
}

beforeEach(() => {
  createReviewClipMock.mockReset().mockResolvedValue(null);
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
        publishedAt: new Date("2026-04-12T00:00:00Z"),
        contentHash: "sha256:missing-source",
        externalReviews: [{ sourceKey: "review", name: "Review Bottle" }],
      },
    }),
  ).rejects.toThrow(`External site ${externalSiteId} not found.`);
  expect(pushUniqueJobMock).not.toHaveBeenCalled();
});

test("stores exact references and queues model resolution after storage", async ({
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
      publishedAt: new Date("2026-04-12T00:00:00Z"),
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
      publishedAt: new Date("2026-04-12T00:00:00Z"),
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
      publishedAt: new Date("2026-04-12T00:00:00Z"),
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

test("stores a review without a clip when generation returns null", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const sourceText = "A useful review that did not produce a clip.";

  await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/no-clip",
      title: "A review without a clip",
      publishedAt: new Date("2026-04-12T00:00:00Z"),
      contentHash: "sha256:no-clip",
      externalReviews: [{ sourceKey: "no-clip", name: "No Clip Bottle" }],
    },
    externalReviewTexts: { "no-clip": sourceText },
  });

  expect(createReviewClipMock).toHaveBeenCalledWith(sourceText);
  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    clip: null,
  });
});

test("does not request a clip when a review has no source text", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });

  await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/no-source-text",
      title: "A review without source text",
      publishedAt: new Date("2026-04-12T00:00:00Z"),
      contentHash: "sha256:no-source-text",
      externalReviews: [
        { sourceKey: "no-source-text", name: "No Source Text Bottle" },
      ],
    },
  });

  expect(createReviewClipMock).not.toHaveBeenCalled();
  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    clip: null,
  });
});

test("stores a generated clip without storing its source text", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const sourceText = "Publisher text that must remain temporary.";
  createReviewClipMock.mockResolvedValue(
    "Rich fruit and gentle smoke lead to a dry finish.",
  );

  await ingestExternalReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/clip",
      title: "A clipped review",
      publishedAt: new Date("2026-04-12T00:00:00Z"),
      contentHash: "sha256:clip",
      externalReviews: [{ sourceKey: "clip", name: "Clip Bottle" }],
    },
    externalReviewTexts: { clip: sourceText },
  });

  expect(createReviewClipMock).toHaveBeenCalledWith(sourceText);
  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    clip: "Rich fruit and gentle smoke lead to a dry finish.",
  });
  expect(
    JSON.stringify(await db.query.externalReviews.findFirst()),
  ).not.toContain(sourceText);
});

test("keeps an existing clip when later generation returns no clip", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const input = {
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/clip-refresh",
      title: "A refreshed review",
      publishedAt: new Date("2026-04-12T00:00:00Z"),
      contentHash: "sha256:clip-refresh",
      externalReviews: [{ sourceKey: "clip-refresh", name: "Clip Bottle" }],
    },
    externalReviewTexts: { "clip-refresh": "A useful review." },
  };
  createReviewClipMock.mockResolvedValueOnce("The first useful clip.");
  await ingestExternalReviewArticle(input);

  createReviewClipMock.mockResolvedValueOnce(null);
  await ingestExternalReviewArticle(input);

  expect(await db.query.externalReviews.findFirst()).toMatchObject({
    clip: "The first useful clip.",
  });
});
