import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  discoverWhiskySagaArticles,
  parseWhiskySagaArticle,
  whiskySagaAdapter,
  type WhiskySagaCursor,
  type WhiskySagaObservation,
} from "./whiskySaga";

const FIRST_URL = "https://www.whiskysaga.com/blog/example-scotch";
const SECOND_URL = "https://www.whiskysaga.com/blog/second-scotch";

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
    cursor: { processedArticleUrls: [FIRST_URL] },
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
  });
});
