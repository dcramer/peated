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

const logTelemetryErrorMock =
  vi.fn<ExternalReviewIngestionServices["reportError"]>();
const pushUniqueJobMock =
  vi.fn<ExternalReviewIngestionServices["queueMissingBottles"]>();
const services: ExternalReviewIngestionServices = {
  queueMissingBottles: pushUniqueJobMock,
  reportError: logTelemetryErrorMock,
};

function ingestExternalReviewArticle(
  input: Parameters<typeof ingestExternalReviewArticleWithServices>[0],
) {
  return ingestExternalReviewArticleWithServices(input, services);
}

beforeEach(() => {
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
