import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverWordsOfWhiskyArticles,
  parseWordsOfWhiskyArticle,
  wordsOfWhiskyAdapter,
  type WordsOfWhiskyCursor,
  type WordsOfWhiskyObservation,
} from "./wordsOfWhisky";

const SINGLE_URL =
  "https://wordsofwhisky.com/bruichladdich-greener-still-review";
const MULTI_URL =
  "https://wordsofwhisky.com/kanosuke-dingle-meikle-toir-the-whisky-exchange";

test("discovers at most twenty current tasting-note articles", async () => {
  const homepage = await loadFixture("wordsofwhisky", "index.html");
  const expandedHomepage = homepage.replace(
    "</main>",
    `${Array.from(
      { length: 25 },
      (_, index) =>
        `<article class="category-tastingnotes"><a href="/generated-${index}/">Generated ${index}</a></article>`,
    ).join("")}</main>`,
  );

  expect(
    discoverWordsOfWhiskyArticles(homepage).map((url) => url.href),
  ).toEqual([SINGLE_URL, MULTI_URL]);
  expect(discoverWordsOfWhiskyArticles(expandedHomepage)).toHaveLength(20);
  expect(discoverWordsOfWhiskyArticles(expandedHomepage).at(-1)?.pathname).toBe(
    "/generated-17",
  );
});

test("extracts one scored review and only its tasting notes", async () => {
  const html = await loadFixture("wordsofwhisky", "single-review.html");
  const parsed = parseWordsOfWhiskyArticle(html, new URL(SINGLE_URL));
  const reparsed = parseWordsOfWhiskyArticle(
    html.replaceAll(
      "Bruichladdich Greener Still 15 Years",
      "Bruichladdich   Greener Still 15 Years",
    ),
    new URL(SINGLE_URL),
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: SINGLE_URL,
    title: "Bruichladdich Greener Still (2026)",
    publishedAt: new Date("2026-08-21T06:00:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    externalReviews: [
      {
        name: "Bruichladdich Greener Still 15 Years (51.6%, OB, 2026)",
        reviewerName: "Thijs Klaverstijn",
        nativeScore: { value: 9, scale: 10, display: "9/10" },
      },
    ],
  });
  expect(parsed.article.externalReviews[0]?.sourceKey).toBe(
    reparsed.article.externalReviews[0]?.sourceKey,
  );
  expect(Object.values(parsed.externalReviewTexts)).toEqual([
    "Nose: Fresh barley and lemon oil. Taste: Mineral malt and gentle spice. Finish: Long, bright, and coastal.",
  ]);
  expect(Object.values(parsed.externalReviewTexts).join(" ")).not.toMatch(
    /Article introduction|Publisher conclusion|Footer content/u,
  );
});

test("extracts each Bottle and normalizes decimal scores", async () => {
  const html = await loadFixture("wordsofwhisky", "multi-review.html");
  const parsed = parseWordsOfWhiskyArticle(html, new URL(MULTI_URL));

  expect(parsed.article.externalReviews).toMatchObject([
    {
      name: "Dingle 2020 5 Years Palo Cortado (59.6%, OB, 330 bts.)",
      reviewerName: "Thijs Klaverstijn",
      nativeScore: { value: 8.7, scale: 10, display: "8.7/10" },
    },
    {
      name: "Kanosuke 2018 (57%, OB ‘Brush Stroke’, C#19044)",
      reviewerName: "Thijs Klaverstijn",
      nativeScore: { value: 9, scale: 10, display: "9/10" },
    },
  ]);
  expect(Object.keys(parsed.externalReviewTexts)).toEqual(
    parsed.article.externalReviews.map(({ sourceKey }) => sourceKey),
  );
  expect(Object.values(parsed.externalReviewTexts).join(" ")).not.toMatch(
    /conclusion|Samples provided|Article introduction/iu,
  );
});

test("resumes without requesting a completed current article", async () => {
  const homepage = await loadFixture("wordsofwhisky", "index.html");
  const multi = await loadFixture("wordsofwhisky", "multi-review.html");
  const observations: ScraperObservation<WordsOfWhiskyObservation>[] = [];
  const checkpoints: WordsOfWhiskyCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/" ? homepage : multi,
  }));
  const session: ScraperSession<WordsOfWhiskyCursor, WordsOfWhiskyObservation> =
    {
      request,
      emit: async (observation) => {
        observations.push(observation);
      },
      checkpoint: async (cursor) => {
        checkpoints.push(cursor);
      },
      remainingRequests: () => 25,
    };

  await wordsOfWhiskyAdapter({
    cursor: { processedArticleUrls: [SINGLE_URL] },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://wordsofwhisky.com/",
    MULTI_URL,
  ]);
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({ sourceKey: MULTI_URL, itemCount: 2 });
  expect(checkpoints).toEqual([
    { processedArticleUrls: [SINGLE_URL, MULTI_URL] },
  ]);
});

test("drops completed URLs that leave the current homepage window", async () => {
  const priorUrls = Array.from(
    { length: 20 },
    (_, index) => `https://wordsofwhisky.com/prior-${index}`,
  );
  const currentUrls = [
    "https://wordsofwhisky.com/new-review",
    ...priorUrls.slice(0, -1),
  ];
  const homepage = `<main>${currentUrls
    .map(
      (url) =>
        `<article class="category-tastingnotes"><a href="${url}">Review</a></article>`,
    )
    .join("")}</main>`;
  const article = (
    await loadFixture("wordsofwhisky", "single-review.html")
  ).replace(/<link[\s\S]+?\/>/u, "");
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/" ? homepage : article,
  }));
  const session: ScraperSession<WordsOfWhiskyCursor, WordsOfWhiskyObservation> =
    {
      request,
      emit: vi.fn(),
      checkpoint,
      remainingRequests: () => 25,
    };

  await wordsOfWhiskyAdapter({
    cursor: { processedArticleUrls: priorUrls },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  const completedUrls = checkpoint.mock.calls.at(-1)?.[0].processedArticleUrls;
  expect(completedUrls).toHaveLength(20);
  expect(new Set(completedUrls)).toEqual(new Set(currentUrls));
});
