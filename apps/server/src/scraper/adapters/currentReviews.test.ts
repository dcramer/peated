import type { ReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";

const FIRST_URL = "https://example.com/first";
const SECOND_URL = "https://example.com/second";
type Cursor = { processedArticleUrls: string[] };

function createSession(
  overrides: Partial<ScraperSession<Cursor, ReviewArticleIngestion>> = {},
): ScraperSession<Cursor, ReviewArticleIngestion> {
  return {
    request: vi.fn(async ({ url }) => ({
      url,
      status: 200,
      headers: {},
      body: url.href,
    })),
    emit: vi.fn(),
    checkpoint: vi.fn(),
    remainingRequests: () => 2,
    ...overrides,
  };
}

function observation(canonicalUrl: string): ReviewArticleIngestion {
  return {
    article: {
      canonicalUrl,
      title: "Example review",
      issue: null,
      publishedAt: null,
      contentHash: "content-hash",
      reviews: [
        {
          sourceKey: "example:review",
          name: "Example Bottle",
          category: null,
          reviewerName: null,
          nativeScore: null,
          normalizedRating: null,
        },
      ],
    },
    reviewTexts: {},
  };
}

test("creates a strict bounded cursor schema", () => {
  const schema = currentReviewCursorSchema(1);

  expect(() =>
    schema.parse({ processedArticleUrls: [FIRST_URL, SECOND_URL] }),
  ).toThrow();
  expect(() =>
    schema.parse({ processedArticleUrls: [], unexpected: true }),
  ).toThrow();
});

test("checkpoints ignored items and emitted reviews in order", async () => {
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const session = createSession({ emit, checkpoint });

  await processCurrentReviews({
    target: "example",
    articles: [new URL(FIRST_URL), new URL(SECOND_URL)],
    articleUrl: (url) => url,
    cursor: null,
    session,
    parse: (response) =>
      response.url.href === FIRST_URL ? null : observation(response.url.href),
  });

  expect(emit).toHaveBeenCalledTimes(1);
  expect(checkpoint.mock.calls.map(([cursor]) => cursor)).toEqual([
    { processedArticleUrls: [FIRST_URL] },
    { processedArticleUrls: [FIRST_URL, SECOND_URL] },
  ]);
});

test("does not checkpoint failed parsing", async () => {
  const checkpoint = vi.fn();
  const session = createSession({ checkpoint });

  await expect(
    processCurrentReviews({
      target: "example",
      articles: [new URL(FIRST_URL)],
      articleUrl: (url) => url,
      cursor: null,
      session,
      parse: () => {
        throw new Error("Invalid review markup.");
      },
    }),
  ).rejects.toThrow("Invalid review markup.");
  expect(checkpoint).not.toHaveBeenCalled();
});

test("does not checkpoint failed ingestion", async () => {
  const checkpoint = vi.fn();
  const session = createSession({
    emit: vi.fn().mockRejectedValue(new Error("Failed to store review.")),
    checkpoint,
  });

  await expect(
    processCurrentReviews({
      target: "example",
      articles: [new URL(FIRST_URL)],
      articleUrl: (url) => url,
      cursor: null,
      session,
      parse: (response) => observation(response.url.href),
    }),
  ).rejects.toThrow("Failed to store review.");
  expect(checkpoint).not.toHaveBeenCalled();
});

test("removes completed URLs outside the current window", async () => {
  const checkpoint = vi.fn();
  const session = createSession({ checkpoint });

  await processCurrentReviews({
    target: "example",
    articles: [new URL(FIRST_URL)],
    articleUrl: (url) => url,
    cursor: { processedArticleUrls: ["https://example.com/stale"] },
    session,
    parse: (response) => observation(response.url.href),
  });

  expect(checkpoint).toHaveBeenCalledWith({
    processedArticleUrls: [FIRST_URL],
  });
});
