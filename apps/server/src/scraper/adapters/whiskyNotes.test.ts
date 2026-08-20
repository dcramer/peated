import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverWhiskyNotesArticles,
  parseWhiskyNotesArticle,
  whiskyNotesAdapter,
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
        name: "Ben Nevis 30 yo 1996",
        reviewerName: "Ruben",
        nativeScore: { value: 91, scale: 100, display: "91/100" },
        normalizedRating: 91,
      },
      {
        name: "Ben Nevis 30 yo 1996",
        nativeScore: { value: 90, scale: 100, display: "90/100" },
        normalizedRating: 90,
      },
      {
        name: "Bowmore 20 yo 2005",
        nativeScore: { value: 91, scale: 100, display: "91/100" },
        normalizedRating: 91,
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
    "Related posts",
  );
});

test("limits discovery to five archive pages", async () => {
  const archive = await loadFixture("whiskynotes", "archive.html");
  const singleReview = await loadFixture("whiskynotes", "single-review.html");
  const multiReview = await loadFixture("whiskynotes", "multi-review.html");
  const observations: ScraperObservation<WhiskyNotesObservation>[] = [];
  const checkpoints: WhiskyNotesCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => {
    if (url.pathname === "/" || url.pathname.startsWith("/page/")) {
      const page =
        url.pathname === "/" ? 1 : Number(url.pathname.split("/")[2]);
      return {
        url,
        status: 200,
        headers: {},
        body: archive
          .replaceAll("kanekou-okinawa-whisky", `single-review-${page}`)
          .replaceAll(
            "bowmore-2005-ben-nevis-1996-whisky-agency",
            `multi-review-${page}`,
          ),
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

  await whiskyNotesAdapter({ cursor: null, session });

  expect(observations).toHaveLength(10);
  expect(new Set(observations.map(({ sourceKey }) => sourceKey))).toHaveLength(
    10,
  );
  expect(request).toHaveBeenCalledTimes(15);
  expect(
    request.mock.calls.some(([{ url }]) => url.pathname === "/page/6/"),
  ).toBe(false);
  expect(checkpoints.at(-1)).toMatchObject({
    page: 5,
    processedArticleUrls: expect.arrayContaining([
      "https://www.whiskynotes.be/2026/world/single-review-5/",
      "https://www.whiskynotes.be/2026/bowmore/multi-review-5/",
    ]),
  });
});
