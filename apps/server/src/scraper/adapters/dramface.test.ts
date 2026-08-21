import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverDramfaceArticles,
  dramfaceAdapter,
  parseDramfaceArticle,
  type DramfaceCursor,
  type DramfaceObservation,
} from "./dramface";

const SINGLE_URL =
  "https://www.dramface.com/all-reviews/2026/springbank-12-cask-strength-2026";
const MULTI_URL =
  "https://www.dramface.com/all-reviews/2026/impex-duo-isle-of-raasay-ardmore";
const WRITERS_URL =
  "https://www.dramface.com/all-reviews/2026/ben-nevis-7yo-bedford-park";

test("discovers at most twenty current review articles", async () => {
  const index = await loadFixture("dramface", "index.html");
  const expandedIndex = index.replace(
    "</main>",
    `${Array.from(
      { length: 25 },
      (_, index) =>
        `<a href="/all-reviews/2026/generated-${index}">Generated ${index}</a>`,
    ).join("")}</main>`,
  );

  expect(discoverDramfaceArticles(index).map((url) => url.href)).toEqual([
    SINGLE_URL,
    MULTI_URL,
  ]);
  expect(discoverDramfaceArticles(expandedIndex)).toHaveLength(20);
  expect(discoverDramfaceArticles(expandedIndex).at(-1)?.pathname).toBe(
    "/all-reviews/2026/generated-17",
  );
});

test("extracts one scored review and only its tasting prose", async () => {
  const html = await loadFixture("dramface", "single-review.html");
  const parsed = parseDramfaceArticle(html, new URL(SINGLE_URL));
  const reparsed = parseDramfaceArticle(
    html.replaceAll("Springbank 12yo", "Springbank   12yo"),
    new URL(SINGLE_URL),
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: SINGLE_URL,
    title: "Springbank 12yo Cask Strength 2026",
    publishedAt: new Date("2026-08-18T00:00:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Springbank 12yo Cask Strength, 2026 release, Batch 29, 56.6% ABV",
        reviewerName: "Drummond Dunbar",
        nativeScore: { value: 8, scale: 10, display: "8/10" },
        normalizedRating: 80,
      },
    ],
  });
  expect(parsed.article.reviews[0]?.sourceKey).toBe(
    reparsed.article.reviews[0]?.sourceKey,
  );
  expect(parsed.article.reviews[0]?.sourceKey).toBe(
    "dramface:a376fb89d0ea5fe526068a1200d1482ec4ab6c6400e43ecfa9b44d65c932fffd",
  );
  expect(Object.values(parsed.reviewTexts)).toEqual([
    "Lemon oil and coastal peat. Dense malt with mineral smoke. A balanced and characterful release.",
  ]);
  expect(Object.values(parsed.reviewTexts).join(" ")).not.toMatch(
    /TL;DR|Publisher summary|Article introduction|Footer content/u,
  );
});

test("accepts a standard HTML datetime value", async () => {
  const html = await loadFixture("dramface", "single-review.html");
  const parsed = parseDramfaceArticle(
    html.replace('datetime="18 Aug"', 'datetime="2026-08-18T09:30:00+01:00"'),
    new URL(SINGLE_URL),
  );

  expect(parsed.article.publishedAt).toEqual(
    new Date("2026-08-18T08:30:00.000Z"),
  );
});

test("extracts each bottle and normalizes decimal scores", async () => {
  const html = await loadFixture("dramface", "multi-bottle.html");
  const parsed = parseDramfaceArticle(html, new URL(MULTI_URL));

  expect(parsed.article.reviews).toMatchObject([
    {
      name: "Isle of Raasay 4yo, Impex Collection, Manzanilla cask, 60.3% ABV",
      reviewerName: "Archie Dunlop",
      nativeScore: { value: 6, scale: 10, display: "6/10" },
      normalizedRating: 60,
    },
    {
      name: "Ardmore 14yo, Impex Collection, ex-bourbon hogshead, 59.2% ABV",
      reviewerName: "Archie Dunlop",
      nativeScore: { value: 7.5, scale: 10, display: "7.5/10" },
      normalizedRating: 75,
    },
  ]);
  expect(Object.keys(parsed.reviewTexts)).toEqual(
    parsed.article.reviews.map(({ sourceKey }) => sourceKey),
  );
});

test("keeps separate reviewers for the same bottle", async () => {
  const html = await loadFixture("dramface", "multi-writer.html");
  const parsed = parseDramfaceArticle(html, new URL(WRITERS_URL));

  expect(
    parsed.article.reviews.map(({ reviewerName }) => reviewerName),
  ).toEqual(["Ogilvie", "Broddy"]);
  expect(
    new Set(parsed.article.reviews.map(({ sourceKey }) => sourceKey)),
  ).toHaveLength(2);
});

test("keeps separate sections for the same bottle and reviewer", async () => {
  const html = await loadFixture("dramface", "multi-bottle.html");
  const repeatedBottle = html.replace(
    "Ardmore 14yo, Impex Collection, ex-bourbon hogshead, 59.2% ABV",
    "Isle of Raasay 4yo, Impex Collection, Manzanilla cask, 60.3% ABV",
  );
  const parsed = parseDramfaceArticle(repeatedBottle, new URL(MULTI_URL));

  expect(parsed.article.reviews.map(({ name }) => name)).toEqual([
    "Isle of Raasay 4yo, Impex Collection, Manzanilla cask, 60.3% ABV",
    "Isle of Raasay 4yo, Impex Collection, Manzanilla cask, 60.3% ABV",
  ]);
  expect(
    new Set(parsed.article.reviews.map(({ sourceKey }) => sourceKey)),
  ).toHaveLength(2);
});

test("resumes without requesting a completed current article", async () => {
  const index = await loadFixture("dramface", "index.html");
  const multi = await loadFixture("dramface", "multi-bottle.html");
  const observations: ScraperObservation<DramfaceObservation>[] = [];
  const checkpoints: DramfaceCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/all-reviews" ? index : multi,
  }));
  const session: ScraperSession<DramfaceCursor, DramfaceObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (cursor) => {
      checkpoints.push(cursor);
    },
    remainingRequests: () => 30,
  };

  await dramfaceAdapter({
    cursor: { processedArticleUrls: [SINGLE_URL] },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.dramface.com/all-reviews",
    MULTI_URL,
  ]);
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({ sourceKey: MULTI_URL, itemCount: 2 });
  expect(checkpoints).toEqual([
    { processedArticleUrls: [SINGLE_URL, MULTI_URL] },
  ]);
});

test("drops completed URLs that leave the current index window", async () => {
  const priorUrls = Array.from(
    { length: 20 },
    (_, index) => `https://www.dramface.com/all-reviews/2026/prior-${index}`,
  );
  const currentUrls = [
    "https://www.dramface.com/all-reviews/2026/new-review",
    ...priorUrls.slice(0, -1),
  ];
  const index = `<main>${currentUrls
    .map((url) => `<a href="${url}">Review</a>`)
    .join("")}</main>`;
  const article = (await loadFixture("dramface", "single-review.html")).replace(
    /<link[\s\S]+?\/>/u,
    "",
  );
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/all-reviews" ? index : article,
  }));
  const session: ScraperSession<DramfaceCursor, DramfaceObservation> = {
    request,
    emit: vi.fn(),
    checkpoint,
    remainingRequests: () => 30,
  };

  await dramfaceAdapter({
    cursor: { processedArticleUrls: priorUrls },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  const completedUrls = checkpoint.mock.calls.at(-1)?.[0].processedArticleUrls;
  expect(completedUrls).toHaveLength(20);
  expect(new Set(completedUrls)).toEqual(new Set(currentUrls));
});
