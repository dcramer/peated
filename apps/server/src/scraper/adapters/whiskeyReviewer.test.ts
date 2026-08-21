import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverWhiskeyReviewerArticles,
  parseWhiskeyReviewerArticle,
  whiskeyReviewerAdapter,
  type WhiskeyReviewerCursor,
  type WhiskeyReviewerObservation,
} from "./whiskeyReviewer";

const BOURBON_URL =
  "https://whiskeyreviewer.com/2026/08/example-bourbon-review-081026";
const SCOTCH_URL =
  "https://whiskeyreviewer.com/2026/08/example-scotch-review-080626";

test("discovers only five links from the Recent Reviews widget", async () => {
  const homepage = await loadFixture("whiskeyreviewer", "index.html");
  const expandedHomepage = homepage.replace(
    "  </div>\n</main>",
    `${Array.from(
      { length: 6 },
      (_, index) =>
        `<a class="post-title" href="/2026/08/generated-${index}-review-080126/">Generated ${index}</a>`,
    ).join("")}  </div>\n</main>`,
  );

  expect(
    discoverWhiskeyReviewerArticles(homepage).map((url) => url.href),
  ).toEqual([BOURBON_URL, SCOTCH_URL]);
  expect(discoverWhiskeyReviewerArticles(expandedHomepage)).toHaveLength(5);
  expect(
    discoverWhiskeyReviewerArticles(expandedHomepage).at(-1)?.pathname,
  ).toBe("/2026/08/generated-2-review-080126");
});

test("extracts the grade and only tasting-note paragraphs", async () => {
  const html = await loadFixture("whiskeyreviewer", "review.html");
  const parsed = parseWhiskeyReviewerArticle(html, new URL(BOURBON_URL));
  const reparsed = parseWhiskeyReviewerArticle(
    html.replace("Example 8 Year Old Bourbon", "Example   8 Year Old Bourbon"),
    new URL(BOURBON_URL),
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: BOURBON_URL,
    title: "Example 8 Year Old Bourbon Review",
    publishedAt: new Date("2026-08-10T00:00:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Example 8 Year Old Bourbon",
        reviewerName: "Rowan Hill",
        nativeScore: { value: 87, scale: 100, display: "B+" },
        normalizedRating: 87,
      },
    ],
  });
  expect(parsed.article.reviews[0]?.sourceKey).toBe(
    reparsed.article.reviews[0]?.sourceKey,
  );
  expect(Object.values(parsed.reviewTexts)).toEqual([
    "The Bourbon The nose has orange peel and vanilla. The palate adds oak spice. The finish is long and dry.",
  ]);
  expect(Object.values(parsed.reviewTexts).join(" ")).not.toMatch(
    /introduction|conclusion|suggested price/iu,
  );
});

test("maps another grade and allows an article without an encoded date", async () => {
  const html = await loadFixture("whiskeyreviewer", "review.html");
  const undatedUrl =
    "https://whiskeyreviewer.com/2026/08/example-bourbon-review";
  const parsed = parseWhiskeyReviewerArticle(
    html
      .replace("example-bourbon-review-081026", "example-bourbon-review")
      .replace("Rating: B+", "Rating: A-"),
    new URL(undatedUrl),
  );

  expect(parsed.article.publishedAt).toBeNull();
  expect(parsed.article.reviews[0]).toMatchObject({
    nativeScore: { value: 90, scale: 100, display: "A-" },
    normalizedRating: 90,
  });
});

test("resumes without requesting a completed current article", async () => {
  const homepage = await loadFixture("whiskeyreviewer", "index.html");
  const article = (
    await loadFixture("whiskeyreviewer", "review.html")
  ).replaceAll("example-bourbon-review-081026", "example-scotch-review-080626");
  const observations: ScraperObservation<WhiskeyReviewerObservation>[] = [];
  const checkpoints: WhiskeyReviewerCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/" ? homepage : article,
  }));
  const session: ScraperSession<
    WhiskeyReviewerCursor,
    WhiskeyReviewerObservation
  > = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (cursor) => {
      checkpoints.push(cursor);
    },
    remainingRequests: () => 6,
  };

  await whiskeyReviewerAdapter({
    cursor: { processedArticleUrls: [BOURBON_URL] },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://whiskeyreviewer.com/",
    SCOTCH_URL,
  ]);
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({
    sourceKey: SCOTCH_URL,
    itemCount: 1,
  });
  expect(checkpoints).toEqual([
    { processedArticleUrls: [BOURBON_URL, SCOTCH_URL] },
  ]);
});

test("drops completed URLs that leave the current homepage window", async () => {
  const priorUrls = Array.from(
    { length: 5 },
    (_, index) =>
      `https://whiskeyreviewer.com/2026/08/prior-${index}-review-080126`,
  );
  const currentUrls = [
    "https://whiskeyreviewer.com/2026/08/new-review-080226",
    ...priorUrls.slice(0, -1),
  ];
  const homepage = `<div class="widget posts-list"><div class="widget-title">Recent Reviews</div>${currentUrls
    .map((url) => `<a class="post-title" href="${url}">Current review</a>`)
    .join("")}</div>`;
  const article = await loadFixture("whiskeyreviewer", "review.html");
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/" ? homepage : article,
  }));
  const session: ScraperSession<
    WhiskeyReviewerCursor,
    WhiskeyReviewerObservation
  > = {
    request,
    emit: vi.fn(),
    checkpoint,
    remainingRequests: () => 6,
  };

  await whiskeyReviewerAdapter({
    cursor: { processedArticleUrls: priorUrls },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  const completedUrls = checkpoint.mock.calls.at(-1)?.[0].processedArticleUrls;
  expect(completedUrls).toHaveLength(5);
  expect(new Set(completedUrls)).toEqual(new Set(currentUrls));
});
