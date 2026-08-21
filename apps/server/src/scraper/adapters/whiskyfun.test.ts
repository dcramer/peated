import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverWhiskyfunArticles,
  parseWhiskyfunArticle,
  whiskyfunAdapter,
  type WhiskyfunCursor,
  type WhiskyfunObservation,
} from "./whiskyfun";

const FIRST_URL =
  "https://www.whiskyfun.com/2026/A-wee-trainload-of-a-dozen-secret-Speysiders.html";
const SECOND_URL = "https://www.whiskyfun.com/2026/A-trio-of-Dailuaine.html";

test("discovers at most twenty current whisky articles", async () => {
  const feed = await loadFixture("whiskyfun", "feed.xml");
  const expandedFeed = feed.replace(
    "</channel>",
    Array.from(
      { length: 20 },
      (_, index) =>
        `<item><title>Whisky article ${index}</title><link>https://www.whiskyfun.com/2026/Whisky-article-${index}.html</link><pubDate>Wed, 19 Aug 2026 08:49:00 +0200</pubDate></item>`,
    ).join("") + "</channel>",
  );

  expect(discoverWhiskyfunArticles(feed)).toEqual([
    {
      canonicalUrl: FIRST_URL,
      title: "A wee trainload of a dozen secret Speysiders",
      publishedAt: new Date("2026-08-20T06:21:00.000Z"),
    },
    {
      canonicalUrl: SECOND_URL,
      title: "A trio of Dailuaine",
      publishedAt: new Date("2026-08-19T06:49:00.000Z"),
    },
  ]);
  expect(discoverWhiskyfunArticles(expandedFeed)).toHaveLength(19);
  expect(discoverWhiskyfunArticles(expandedFeed).at(-1)?.title).toBe(
    "Whisky article 16",
  );
});

test("extracts scored reviews with stable source keys", async () => {
  const html = await loadFixture("whiskyfun", "article.html");
  const article = {
    canonicalUrl: SECOND_URL,
    title: "A trio of Dailuaine",
    publishedAt: new Date("2026-08-19T06:49:00.000Z"),
  };
  const parsed = parseWhiskyfunArticle(html, article);
  const reparsed = parseWhiskyfunArticle(
    html.replaceAll("Dailuaine 5 yo", "Dailuaine   5 yo"),
    article,
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: SECOND_URL,
    title: "A trio of Dailuaine",
    publishedAt: new Date("2026-08-19T06:49:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Dailuaine 5 yo 2020/2025 (61%, Sample Bottler, cask #1)",
        reviewerName: "Serge Valentin",
        nativeScore: { value: 87, scale: 100, display: "87 points" },
        normalizedRating: 87,
      },
      {
        name: "Dailuaine 23 yo 2002/2025 (57%, Sample Bottler, cask #2)",
        reviewerName: "Serge Valentin",
        nativeScore: { value: 89, scale: 100, display: "89 points" },
        normalizedRating: 89,
      },
    ],
  });
  expect(parsed.article.reviews.map(({ sourceKey }) => sourceKey)).toEqual(
    reparsed.article.reviews.map(({ sourceKey }) => sourceKey),
  );
  expect(Object.keys(parsed.reviewTexts)).toEqual(
    parsed.article.reviews.map(({ sourceKey }) => sourceKey),
  );
  expect(Object.values(parsed.reviewTexts).join(" ")).not.toContain(
    "Unscored introduction",
  );
});

test("resumes without requesting a completed article", async () => {
  const feed = await loadFixture("whiskyfun", "feed.xml");
  const html = await loadFixture("whiskyfun", "article.html");
  const observations: ScraperObservation<WhiskyfunObservation>[] = [];
  const checkpoints: WhiskyfunCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/whatsnew.xml" ? feed : html,
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (nextCursor) => {
      checkpoints.push(nextCursor);
    },
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: { processedArticleUrls: [FIRST_URL] },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskyfun.com/whatsnew.xml",
    SECOND_URL,
  ]);
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({
    sourceKey: SECOND_URL,
    itemCount: 2,
  });
  expect(checkpoints).toEqual([
    { processedArticleUrls: [FIRST_URL, SECOND_URL] },
  ]);
});

test("drops completed URLs that leave the current feed window", async () => {
  const html = await loadFixture("whiskyfun", "article.html");
  const priorUrls = Array.from(
    { length: 20 },
    (_, index) => `https://www.whiskyfun.com/2026/Prior-${index}.html`,
  );
  const currentUrls = [
    "https://www.whiskyfun.com/2026/New-review.html",
    ...priorUrls.slice(0, -1),
  ];
  const feed = `<?xml version="1.0"?><rss><channel>${currentUrls
    .map(
      (url, index) =>
        `<item><title>Review ${index}</title><link>${url}</link><pubDate>Wed, 19 Aug 2026 08:49:00 +0200</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/whatsnew.xml" ? feed : html,
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit: vi.fn(),
    checkpoint,
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: { processedArticleUrls: priorUrls },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  const completedUrls = checkpoint.mock.calls.at(-1)?.[0].processedArticleUrls;
  expect(completedUrls).toHaveLength(20);
  expect(new Set(completedUrls)).toEqual(new Set(currentUrls));
});
