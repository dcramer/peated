import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  discoverWhiskyStudyArticles,
  parseWhiskyStudyArticle,
  whiskyStudyAdapter,
  type WhiskyStudyCursor,
  type WhiskyStudyObservation,
} from "./whiskyStudy";

const FIRST_URL = "https://thewhiskystudy.com/reviews-3/example-scotch-review";
const SECOND_URL = "https://thewhiskystudy.com/reviews-3/second-scotch-review";

test("discovers only 20 current Scotch article cards", async () => {
  const index = await loadFixture("whiskystudy", "index.html");
  const expandedIndex = index.replace(
    "</main>",
    `${Array.from(
      { length: 20 },
      (_, index) =>
        `<article class="blog-item"><a href="/reviews-3/generated-${index}">Generated ${index}</a></article>`,
    ).join("")}</main>`,
  );

  expect(discoverWhiskyStudyArticles(index).map((url) => url.href)).toEqual([
    FIRST_URL,
    SECOND_URL,
  ]);
  expect(discoverWhiskyStudyArticles(expandedIndex)).toHaveLength(20);
  expect(discoverWhiskyStudyArticles(expandedIndex).at(-1)?.pathname).toBe(
    "/reviews-3/generated-17",
  );
});

test("extracts source facts and only direct tasting paragraphs", async () => {
  const html = await loadFixture("whiskystudy", "review.html");
  const parsed = parseWhiskyStudyArticle(html, new URL(FIRST_URL));
  const decimalScore = parseWhiskyStudyArticle(
    html.replace("Score: 92", "Score: 92,5 / 100"),
    new URL(FIRST_URL),
  );

  expect(parsed?.article).toMatchObject({
    canonicalUrl: FIRST_URL,
    title: "Example Scotch 18 Year Shelf Review",
    publishedAt: new Date("2026-07-04T19:03:15.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    externalReviews: [
      {
        name: "Example Scotch 18 Year",
        reviewerName: "Chris Ellis",
        nativeScore: { value: 92, scale: 100, display: "92/100" },
      },
    ],
  });
  expect(decimalScore?.article.externalReviews[0]).toMatchObject({
    nativeScore: { value: 92.5, scale: 100, display: "92,5/100" },
  });
  expect(Object.values(parsed?.externalReviewTexts ?? {})).toEqual([
    "Nose: Orchard fruit and soft wax. Palate: Malt, citrus, and gentle oak. Finish: Long and lightly spiced.",
  ]);
  expect(
    Object.values(parsed?.externalReviewTexts ?? {}).join(" "),
  ).not.toMatch(/introduction|price|age:|review date|final thoughts/iu);
});

test("skips a clear non-review but rejects an incomplete review", async () => {
  const html = await loadFixture("whiskystudy", "review.html");

  expect(
    parseWhiskyStudyArticle(
      html.replaceAll(/(?:Nose|Palate|Finish):/gu, "Background:"),
      new URL(FIRST_URL),
    ),
  ).toBeNull();
  expect(() =>
    parseWhiskyStudyArticle(
      html.replace("Score: 92", "Score unavailable"),
      new URL(FIRST_URL),
    ),
  ).toThrow("The Whisky Study score is missing or invalid.");
});

test("resumes without requesting a completed current article", async () => {
  const index = await loadFixture("whiskystudy", "index.html");
  const article = (await loadFixture("whiskystudy", "review.html")).replaceAll(
    "example-scotch-review",
    "second-scotch-review",
  );
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/reviews-3" ? index : article,
  }));
  const session: ScraperSession<WhiskyStudyCursor, WhiskyStudyObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 22,
  };

  await whiskyStudyAdapter({
    cursor: { processedArticleUrls: [FIRST_URL] },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://thewhiskystudy.com/reviews-3",
    SECOND_URL,
  ]);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: SECOND_URL, itemCount: 1 }),
  );
  expect(checkpoint).toHaveBeenCalledWith({
    processedArticleUrls: [FIRST_URL, SECOND_URL],
  });
});
