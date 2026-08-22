import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  discoverOlderWhiskySagaPage,
  discoverWhiskySagaArticles,
  parseWhiskySagaArticle,
  whiskySagaAdapter,
  WhiskySagaCursorSchema,
  type WhiskySagaCursor,
  type WhiskySagaObservation,
} from "./whiskySaga";

const FIRST_URL = "https://www.whiskysaga.com/blog/example-scotch";
const SECOND_URL = "https://www.whiskysaga.com/blog/second-scotch";
const HISTORY_URL =
  "https://www.whiskysaga.com/blog?offset=1775418696457&category=Scotland";
const OLDER_HISTORY_URL =
  "https://www.whiskysaga.com/blog?offset=1772902711929&category=Scotland";
const COMPLETED_HISTORY: Pick<
  WhiskySagaCursor,
  "nextHistoryUrl" | "processedHistoryArticleUrls" | "historyComplete"
> = {
  nextHistoryUrl: null,
  processedHistoryArticleUrls: [],
  historyComplete: true,
};

function historyPage({ older = true }: { older?: boolean } = {}) {
  return `<main><article class="blog-item"><a href="${FIRST_URL}">Review</a></article></main>
    ${
      older
        ? `<div class="older"><a rel="next" href="${OLDER_HISTORY_URL}">Older Posts</a></div>`
        : ""
    }`;
}

test("discovers only 20 current Scotland article cards", async () => {
  const index = await loadFixture("whiskysaga", "index.html");
  const expandedIndex = index.replace(
    "</main>",
    `${Array.from(
      { length: 20 },
      (_, index) =>
        `<article class="blog-item"><a href="/blog/generated-${index}">Generated ${index}</a></article>`,
    ).join("")}</main>`,
  );

  expect(discoverWhiskySagaArticles(index).map((url) => url.href)).toEqual([
    FIRST_URL,
    SECOND_URL,
  ]);
  expect(discoverWhiskySagaArticles(expandedIndex)).toHaveLength(20);
  expect(discoverWhiskySagaArticles(expandedIndex).at(-1)?.pathname).toBe(
    "/blog/generated-17",
  );
});

test("accepts only the public Scotland older-page link", () => {
  expect(discoverOlderWhiskySagaPage(historyPage())?.href).toBe(
    OLDER_HISTORY_URL,
  );
  expect(
    discoverOlderWhiskySagaPage(
      '<div class="older"><a rel="next" href="/blog?offset=1772902711929&category=World">Older</a></div>',
    ),
  ).toBeNull();
  expect(
    discoverOlderWhiskySagaPage(
      '<div class="older"><a rel="next" href="/blog?offset=1772902711929&category=Scotland&format=json">Older</a></div>',
    ),
  ).toBeNull();
});

test("accepts the current-only cursor and adds history defaults", () => {
  expect(
    WhiskySagaCursorSchema.parse({ processedArticleUrls: [FIRST_URL] }),
  ).toEqual({
    processedArticleUrls: [FIRST_URL],
    nextHistoryUrl: null,
    processedHistoryArticleUrls: [],
    historyComplete: false,
  });
});

test("extracts source facts and only direct tasting paragraphs", async () => {
  const html = await loadFixture("whiskysaga", "review.html");
  const parsed = parseWhiskySagaArticle(html, new URL(FIRST_URL));
  const decimalScore = parseWhiskySagaArticle(
    html.replace("Score 92/100", "Score: 92,5 / 100"),
    new URL(FIRST_URL),
  );

  expect(parsed?.article).toMatchObject({
    canonicalUrl: FIRST_URL,
    title: "Example Scotch 18 YO",
    publishedAt: new Date("2026-08-17T20:36:08.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Example Scotch 18 YO",
        reviewerName: "Thomas Øhrbom",
        nativeScore: { value: 92, scale: 100, display: "92/100" },
        normalizedRating: 92,
      },
    ],
  });
  expect(decimalScore?.article.reviews[0]).toMatchObject({
    nativeScore: { value: 92.5, scale: 100, display: "92,5/100" },
    normalizedRating: 93,
  });
  expect(Object.values(parsed?.reviewTexts ?? {})).toEqual([
    "Nose: Orchard fruit and soft wax. Palate: Malt, citrus, and gentle oak. Finish: Long and lightly spiced.",
  ]);
  expect(Object.values(parsed?.reviewTexts ?? {}).join(" ")).not.toMatch(
    /introduction|price|comment|sláinte/iu,
  );
});

test("accepts object author metadata", async () => {
  const html = await loadFixture("whiskysaga", "review.html");
  const parsed = parseWhiskySagaArticle(
    html.replace(
      '"author": "Thomas Øhrbom"',
      '"author": { "@type": "Person", "name": "Thomas Øhrbom" }',
    ),
    new URL(FIRST_URL),
  );

  expect(parsed?.article.reviews[0]?.reviewerName).toBe("Thomas Øhrbom");
});

test("skips a clear non-review but rejects an incomplete review", async () => {
  const html = await loadFixture("whiskysaga", "review.html");

  expect(
    parseWhiskySagaArticle(
      html.replaceAll(/(?:Nose|Palate|Finish):/gu, "Background:"),
      new URL(FIRST_URL),
    ),
  ).toBeNull();
  expect(() =>
    parseWhiskySagaArticle(
      html.replace("Score 92/100", "Score unavailable"),
      new URL(FIRST_URL),
    ),
  ).toThrow("Whisky Saga score is missing or invalid.");
});

test("resumes without requesting a completed current article", async () => {
  const index = await loadFixture("whiskysaga", "index.html");
  const article = (await loadFixture("whiskysaga", "review.html")).replaceAll(
    "example-scotch",
    "second-scotch",
  );
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/blog/category/Scotland" ? index : article,
  }));
  const session: ScraperSession<WhiskySagaCursor, WhiskySagaObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 22,
  };

  await whiskySagaAdapter({
    cursor: {
      processedArticleUrls: [FIRST_URL],
      ...COMPLETED_HISTORY,
    },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskysaga.com/blog/category/Scotland",
    SECOND_URL,
  ]);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: SECOND_URL, itemCount: 1 }),
  );
  expect(checkpoint).toHaveBeenCalledWith({
    processedArticleUrls: [FIRST_URL, SECOND_URL],
    ...COMPLETED_HISTORY,
  });
});

test("imports one older Scotland page and advances the history cursor", async () => {
  const article = await loadFixture("whiskysaga", "review.html");
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/blog/category/Scotland"
        ? `<main></main><div class="older"><a rel="next" href="${HISTORY_URL}">Older Posts</a></div>`
        : url.href === HISTORY_URL
          ? historyPage()
          : article,
  }));
  const session: ScraperSession<WhiskySagaCursor, WhiskySagaObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 22,
  };

  await whiskySagaAdapter({ cursor: null, session });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskysaga.com/blog/category/Scotland",
    HISTORY_URL,
    FIRST_URL,
  ]);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: FIRST_URL, itemCount: 1 }),
  );
  expect(checkpoint.mock.calls.at(-1)?.[0]).toEqual({
    processedArticleUrls: [],
    nextHistoryUrl: OLDER_HISTORY_URL,
    processedHistoryArticleUrls: [],
    historyComplete: false,
  });
});

test("resumes within an older page and records the history end", async () => {
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/blog/category/Scotland"
        ? "<main></main>"
        : historyPage({ older: false }),
  }));
  const session: ScraperSession<WhiskySagaCursor, WhiskySagaObservation> = {
    request,
    emit: vi.fn(),
    checkpoint,
    remainingRequests: () => 22,
  };

  await whiskySagaAdapter({
    cursor: {
      processedArticleUrls: [],
      nextHistoryUrl: HISTORY_URL,
      processedHistoryArticleUrls: [FIRST_URL],
      historyComplete: false,
    },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskysaga.com/blog/category/Scotland",
    HISTORY_URL,
  ]);
  expect(checkpoint.mock.calls.at(-1)?.[0]).toEqual({
    processedArticleUrls: [],
    nextHistoryUrl: null,
    processedHistoryArticleUrls: [],
    historyComplete: true,
  });
});
