import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverWhiskyNotesArticles,
  parseWhiskyNotesArticle,
  whiskyNotesAdapter,
  WhiskyNotesCursorSchema,
  type WhiskyNotesCursor,
  type WhiskyNotesObservation,
} from "./whiskyNotes";

const SINGLE_URL =
  "https://www.whiskynotes.be/2026/world/kanekou-okinawa-whisky/";
const MULTI_URL =
  "https://www.whiskynotes.be/2026/bowmore/bowmore-2005-ben-nevis-1996-whisky-agency/";

test("discovers whisky articles and excludes other content", async () => {
  const archive = await loadFixture("whiskynotes", "archive.html");

  expect(discoverWhiskyNotesArticles(archive).map((url) => url.href)).toEqual([
    SINGLE_URL,
    MULTI_URL,
  ]);
});

test("extracts multi-bottle reviews with stable source keys", async () => {
  const html = await loadFixture("whiskynotes", "multi-review.html");
  const parsed = parseWhiskyNotesArticle(html, new URL(MULTI_URL));
  const reparsed = parseWhiskyNotesArticle(
    html.replaceAll("Ben Nevis 30 yo", "Ben Nevis   30 yo"),
    new URL(MULTI_URL),
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: MULTI_URL,
    title: "Bowmore 2005 / 2x Ben Nevis 1996 (The Whisky Agency)",
    publishedAt: new Date("2026-05-04T00:30:43.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Ben Nevis 30 yo 1996 (43,4%, The Whisky Agency 2026, sherry butt)",
        reviewerName: "Ruben",
        nativeScore: { value: 91, scale: 100, display: "91/100" },
        normalizedRating: 91,
      },
      {
        name: "Ben Nevis 30 yo 1996 (45,3%, The Whisky Agency & Sansibar 2026, hogshead)",
        nativeScore: { value: 90, scale: 100, display: "90/100" },
        normalizedRating: 90,
      },
      {
        name: "Bowmore 20 yo 2005 (48,8%, The Whisky Agency 2026, refill sherry hogshead)",
        nativeScore: { value: 91, scale: 100, display: "91/100" },
        normalizedRating: 91,
      },
    ],
  });
  expect(parsed.article.reviews.map(({ name }) => name)).not.toContain(
    "Three independent releases",
  );
  expect(new Set(parsed.article.reviews.map(({ name }) => name))).toHaveLength(
    3,
  );
  expect(parsed.article.reviews.map(({ sourceKey }) => sourceKey)).toEqual(
    reparsed.article.reviews.map(({ sourceKey }) => sourceKey),
  );
  expect(Object.keys(parsed.reviewTexts)).toEqual(
    parsed.article.reviews.map(({ sourceKey }) => sourceKey),
  );
  expect(Object.values(parsed.reviewTexts).join(" ")).not.toContain(
    "Related posts",
  );
});

async function runAdapter(
  cursor: WhiskyNotesCursor | null,
  {
    emptyCurrent = false,
    endPage,
  }: { emptyCurrent?: boolean; endPage?: number } = {},
) {
  const archive = await loadFixture("whiskynotes", "archive.html");
  const singleReview = await loadFixture("whiskynotes", "single-review.html");
  const multiReview = await loadFixture("whiskynotes", "multi-review.html");
  const observations: ScraperObservation<WhiskyNotesObservation>[] = [];
  const checkpoints: WhiskyNotesCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => {
    if (url.pathname === "/" || url.pathname.startsWith("/page/")) {
      const page =
        url.pathname === "/" ? 1 : Number(url.pathname.split("/")[2]);
      let body = archive
        .replaceAll("kanekou-okinawa-whisky", `single-review-${page}`)
        .replaceAll(
          "bowmore-2005-ben-nevis-1996-whisky-agency",
          `multi-review-${page}`,
        );
      if (endPage !== undefined && page >= endPage) {
        body = body.replace(/<link rel="next"[^>]+>/, "");
      }
      if (emptyCurrent && page === 1) {
        body = '<html><head><link rel="next"></head><body></body></html>';
      }
      return {
        url,
        status: 200,
        headers: {},
        body,
      };
    }
    return {
      url,
      status: 200,
      headers: {},
      body: url.pathname.includes("single-review") ? singleReview : multiReview,
    };
  });
  const session: ScraperSession<WhiskyNotesCursor, WhiskyNotesObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (cursor) => {
      checkpoints.push(cursor);
    },
    remainingRequests: () => 100,
  };

  await whiskyNotesAdapter({ cursor, session });

  return { checkpoints, observations, request };
}

test("continues four archive pages per run and refreshes the current page", async () => {
  const first = await runAdapter(null);

  expect(first.observations).toHaveLength(8);
  expect(first.request).toHaveBeenCalledTimes(12);
  expect(first.checkpoints.at(-1)).toEqual({
    page: 5,
    processedArticleUrls: [],
    currentArticleUrls: [
      "https://www.whiskynotes.be/2026/world/single-review-1/",
      "https://www.whiskynotes.be/2026/bowmore/multi-review-1/",
    ],
    historyComplete: false,
  });

  const second = await runAdapter(first.checkpoints.at(-1)!);

  expect(second.observations).toHaveLength(8);
  expect(second.request).toHaveBeenCalledTimes(13);
  expect(
    second.request.mock.calls.some(([{ url }]) => url.pathname === "/page/9/"),
  ).toBe(false);
  expect(second.checkpoints.at(-1)).toMatchObject({
    page: 9,
    processedArticleUrls: [],
    historyComplete: false,
  });
});

test("resumes within a history page without requesting stored articles", async () => {
  const cursor = WhiskyNotesCursorSchema.parse({
    page: 3,
    processedArticleUrls: [
      "https://www.whiskynotes.be/2026/world/single-review-3/",
    ],
    currentArticleUrls: [
      "https://www.whiskynotes.be/2026/world/single-review-1/",
      "https://www.whiskynotes.be/2026/bowmore/multi-review-1/",
    ],
    historyComplete: false,
  });

  const result = await runAdapter(cursor);

  expect(result.observations).toHaveLength(7);
  expect(
    result.request.mock.calls.some(([{ url }]) =>
      url.pathname.includes("single-review-3"),
    ),
  ).toBe(false);
  expect(
    result.request.mock.calls.some(([{ url }]) =>
      url.pathname.includes("multi-review-3"),
    ),
  ).toBe(true);
  expect(result.checkpoints.at(-1)).toMatchObject({
    page: 7,
    processedArticleUrls: [],
  });
});

test("ingests a new current review while history points to an older page", async () => {
  const cursor = WhiskyNotesCursorSchema.parse({
    page: 5,
    processedArticleUrls: [],
    currentArticleUrls: [
      "https://www.whiskynotes.be/2026/world/single-review-1/",
    ],
    historyComplete: false,
  });

  const result = await runAdapter(cursor);

  expect(result.observations.at(0)?.sourceKey).toBe(
    "https://www.whiskynotes.be/2026/bowmore/multi-review-1/",
  );
  expect(
    result.request.mock.calls.some(([{ url }]) =>
      url.pathname.includes("single-review-1"),
    ),
  ).toBe(false);
});

test("stops history at the archive end but keeps checking current reviews", async () => {
  const cursor = WhiskyNotesCursorSchema.parse({
    page: 3,
    processedArticleUrls: [],
    currentArticleUrls: [
      "https://www.whiskynotes.be/2026/world/single-review-1/",
      "https://www.whiskynotes.be/2026/bowmore/multi-review-1/",
    ],
    historyComplete: false,
  });

  const completed = await runAdapter(cursor, { endPage: 3 });
  const completedCursor = completed.checkpoints.at(-1)!;
  expect(completedCursor).toMatchObject({
    page: 3,
    historyComplete: true,
  });

  const currentOnly = await runAdapter(completedCursor, { endPage: 3 });
  expect(currentOnly.observations).toHaveLength(0);
  expect(currentOnly.request).toHaveBeenCalledTimes(1);
  expect(currentOnly.request).toHaveBeenCalledWith({
    target: "whiskynotes",
    url: new URL("https://www.whiskynotes.be/"),
  });
});

test("accepts cursors stored by the bounded pilot adapter", () => {
  expect(
    WhiskyNotesCursorSchema.parse({
      page: 5,
      processedArticleUrls: ["https://www.whiskynotes.be/2026/world/example/"],
    }),
  ).toEqual({
    page: 5,
    processedArticleUrls: ["https://www.whiskynotes.be/2026/world/example/"],
    currentArticleUrls: [],
    historyComplete: false,
  });
});

test("does not treat an empty current listing as completed history", async () => {
  await expect(runAdapter(null, { emptyCurrent: true })).rejects.toThrow(
    "WhiskyNotes current archive contains no review articles.",
  );
});
