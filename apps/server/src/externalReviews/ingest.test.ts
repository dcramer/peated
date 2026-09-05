import { db } from "@peated/server/db";
import {
  bottleTags,
  bottleTombstones,
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  tags,
} from "@peated/server/db/schema";
import {
  ingestExternalReviewArticle as ingestExternalReviewArticleWithServices,
  type ExternalReviewIngestionServices,
} from "@peated/server/externalReviews/ingest";
import { routerClient } from "@peated/server/orpc/router";
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

test.for<[string, string[]]>([
  [
    "Nose: VANILLA, ripe apples and cinnamon. Finish: vanilla.",
    ["apple", "cinnamon", "vanilla"],
  ],
  ["Palate: pineapple and sweet fruit.", []],
  [
    "Palate: dark-chocolate and orange peel.",
    ["dark chocolate", "orange peel"],
  ],
  ["Nose: chocolate. Palate: dark chocolate.", ["chocolate", "dark chocolate"]],
  ["Nose: no smoke or oak, just vanilla.", ["vanilla"]],
  [
    "Palate: without a trace of dark chocolate, but cinnamon remains.",
    ["cinnamon"],
  ],
  ["Nose: no smoke. Palate: smoky and vanilla.", ["smoke", "vanilla"]],
  ["Nose: no smoke\nPalate: vanilla.", ["vanilla"]],
  [
    "Palate: less smoky than last year. Not only vanilla but cinnamon.",
    ["cinnamon", "smoke", "vanilla"],
  ],
  ["Finish: no shortage of vanilla, smoke-free.", ["vanilla"]],
  ["Palate: shared alias.", []],
  ["Palate: oak.", ["oak"]],
  [
    "Nose: toasted marshmallow and salt-water taffy.",
    ["saltwater taffy", "toasted marshmallow"],
  ],
  ["Finish: vanilla taffy.", ["saltwater taffy", "vanilla"]],
  ["Palate: creme brulee and candyfloss.", ["cotton candy", "crème brûlée"]],
  ["Nose: no dill pickle, but spearmint remains.", ["spearmint"]],
])(
  "extracts review tags from %s",
  async ([reviewText, expected], { fixtures }) => {
    await db.insert(tags).values(
      [
        { name: "apple", synonyms: ["apples"] },
        { name: "vanilla", synonyms: ["shared alias"] },
        { name: "cinnamon", synonyms: ["shared alias", "oak"] },
        { name: "smoke", synonyms: ["smoky"] },
        { name: "oak" },
        { name: "chocolate" },
        { name: "dark chocolate" },
        { name: "orange" },
        { name: "orange peel" },
        { name: "toasted marshmallow" },
        {
          name: "saltwater taffy",
          synonyms: ["salt water taffy", "taffy"],
        },
        {
          name: "crème brûlée",
          synonyms: ["creme brulee", "creme brûlée", "crème brulee"],
        },
        { name: "cotton candy", synonyms: ["candy floss", "candyfloss"] },
        { name: "dill pickle", synonyms: ["dill pickles"] },
        { name: "spearmint" },
      ].map((tag) => ({ ...tag, tagCategory: "sweet" as const })),
    );
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await ingestExternalReviewArticle({
      externalSiteId: site.id,
      fetchedAt: new Date(),
      article: {
        canonicalUrl: "https://reviews.example/articles/tags",
        title: "Vanilla and oak in the article title are not tasting evidence",
        publishedAt: new Date("2026-09-01T00:00:00Z"),
        contentHash: "sha256:tags",
        externalReviews: [{ sourceKey: "tags", name: "Review Bottle" }],
      },
      externalReviewTexts: { tags: reviewText },
    });
    const review = await db.query.externalReviews.findFirst();
    expect(review?.tags).toEqual(expected);
    expect(await db.select().from(bottleTags)).toEqual([]);
  },
);

test("refreshes tags per review, preserves them without text, and exposes them through the API", async ({
  fixtures,
}) => {
  await fixtures.Tag({ name: "vanilla" });
  await fixtures.Tag({ name: "smoke", synonyms: ["smoky"] });
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const user = await fixtures.User({ mod: true });
  const input = {
    externalSiteId: site.id,
    fetchedAt: new Date(),
    article: {
      canonicalUrl: "https://reviews.example/articles/tag-refresh",
      title: "Two reviewed bottles",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      contentHash: "sha256:tag-refresh",
      externalReviews: [
        { sourceKey: "first", name: "First Bottle" },
        { sourceKey: "second", name: "Second Bottle" },
      ],
    },
  };
  const result = await ingestExternalReviewArticle({
    ...input,
    externalReviewTexts: {
      first: "Nose: vanilla, vanilla.",
      second: "Palate: smoky.",
    },
  });
  const readTags = async () => {
    const { results } = await routerClient.externalReviews.list(
      { site: site.type, sort: "name" },
      { context: { user } },
    );
    return results.map(({ id, extractedTags }) => ({ id, extractedTags }));
  };
  expect(await readTags()).toEqual([
    { id: result.externalReviewIds[0], extractedTags: ["vanilla"] },
    { id: result.externalReviewIds[1], extractedTags: ["smoke"] },
  ]);

  await ingestExternalReviewArticle(input);
  await ingestExternalReviewArticle({
    ...input,
    externalReviewTexts: { first: "Palate: smoky." },
  });
  expect(await readTags()).toEqual([
    { id: result.externalReviewIds[0], extractedTags: ["smoke"] },
    { id: result.externalReviewIds[1], extractedTags: ["smoke"] },
  ]);

  // A dictionary edit is used on the next import, even with the same article hash.
  await db.update(tags).set({ synonyms: [] }).where(eq(tags.name, "smoke"));
  await ingestExternalReviewArticle({
    ...input,
    externalReviewTexts: { first: "Palate: smoky." },
  });
  expect(await readTags()).toEqual([
    { id: result.externalReviewIds[0], extractedTags: [] },
    { id: result.externalReviewIds[1], extractedTags: ["smoke"] },
  ]);
  await db
    .delete(externalReviews)
    .where(eq(externalReviews.id, result.externalReviewIds[1]));
  expect(await readTags()).toEqual([
    { id: result.externalReviewIds[0], extractedTags: [] },
  ]);
});

test("retains complete bodies internally, refreshes them per review, and preserves them when absent", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.ApprovedExternalReviewPublication({
    externalSiteId: site.id,
    approvedAt: new Date(),
  });
  const bottle = await fixtures.Bottle();
  const user = await fixtures.User({ mod: true });
  await fixtures.Tag({ name: "vanilla" });
  await fixtures.Tag({ name: "oak" });
  const body = `An introduction about oak casks.\n\n${"Long review prose. ".repeat(3000)}\n\nNose: Vanilla.\n\nThe final conclusion.`;
  const fetchedAt = new Date("2026-09-01T12:00:00Z");
  const input = {
    externalSiteId: site.id,
    fetchedAt,
    article: {
      canonicalUrl: "https://reviews.example/articles/internal-bodies",
      title: "Two reviews",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
      contentHash: "sha256:internal-bodies",
      externalReviews: [
        { sourceKey: "first", name: bottle.fullName },
        { sourceKey: "second", name: "Second Bottle" },
      ],
    },
  };
  const {
    externalReviewIds: [firstId, secondId],
  } = await ingestExternalReviewArticle({
    ...input,
    externalReviewTexts: { first: "Nose: Vanilla." },
    externalReviewBodies: { first: body, second: "Second review: oak." },
  });
  const readBodies = () =>
    db
      .select()
      .from(externalReviewBodies)
      .orderBy(asc(externalReviewBodies.externalReviewId));
  expect(await readBodies()).toEqual([
    { externalReviewId: firstId, body, fetchedAt },
    { externalReviewId: secondId, body: "Second review: oak.", fetchedAt },
  ]);
  expect(createReviewClipMock).toHaveBeenCalledTimes(1);
  for (const response of [
    await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    }),
    await routerClient.externalReviews.list(
      { site: site.type, sort: "name" },
      { context: { user } },
    ),
  ]) {
    expect(
      response.results.find(({ id }) => id === firstId)?.extractedTags,
    ).toEqual(["vanilla"]);
    expect(response.results.every((review) => !("body" in review))).toBe(true);
    expect(JSON.stringify(response)).not.toContain("Long review prose");
  }

  await ingestExternalReviewArticle({
    ...input,
    fetchedAt: new Date("2026-09-02T12:00:00Z"),
  });
  expect(await readBodies()).toEqual([
    { externalReviewId: firstId, body, fetchedAt },
    { externalReviewId: secondId, body: "Second review: oak.", fetchedAt },
  ]);
  const refreshedAt = new Date("2026-09-02T13:00:00Z");
  await ingestExternalReviewArticle({
    ...input,
    fetchedAt: refreshedAt,
    externalReviewBodies: { first: "Updated introduction.\n\nVanilla finish." },
  });
  expect(await readBodies()).toEqual([
    {
      externalReviewId: firstId,
      body: "Updated introduction.\n\nVanilla finish.",
      fetchedAt: refreshedAt,
    },
    { externalReviewId: secondId, body: "Second review: oak.", fetchedAt },
  ]);
  await db.delete(externalReviews).where(eq(externalReviews.id, firstId));
  expect(await readBodies()).toEqual([
    { externalReviewId: secondId, body: "Second review: oak.", fetchedAt },
  ]);
});
