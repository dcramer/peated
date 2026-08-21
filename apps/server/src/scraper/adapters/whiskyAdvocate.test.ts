import { loadFixture } from "@peated/server/lib/test/fixtures";
import { load as cheerio } from "cheerio";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  type WhiskyAdvocateCursor,
  type WhiskyAdvocateObservation,
  parseReviewPublishedAt,
  parseReviews,
  whiskyAdvocateAdapter,
  WhiskyAdvocateCursorSchema,
} from "./whiskyAdvocate";

test("accepts a cursor stored by the previous adapter", () => {
  expect(
    WhiskyAdvocateCursorSchema.parse({ processedIssues: ["Winter 2023"] }),
  ).toEqual({ processedIssues: ["Winter 2023"] });
  expect(
    WhiskyAdvocateCursorSchema.parse({
      issue: "Winter 2023",
      processedReviewUrls: ["https://whiskyadvocate.com/example-review"],
    }),
  ).toEqual({
    issue: "Winter 2023",
    processedReviewUrls: ["https://whiskyadvocate.com/example-review"],
  });
});

test("parses the publisher date template", async () => {
  const html = await loadFixture("whiskyadvocate", "review-page.html");

  expect(parseReviewPublishedAt(html)).toEqual(
    new Date("2023-12-19T00:00:00.000Z"),
  );
  expect(parseReviewPublishedAt("<html></html>")).toBeNull();
  expect(() =>
    parseReviewPublishedAt('<script>"datePublished": "not-a-date"</script>'),
  ).toThrow("Whisky Advocate review date is invalid.");
});

test("fetches dates for the latest issue and checkpoints each review", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const reviewHtml = await loadFixture("whiskyadvocate", "bottle-list.html");
  const articleHtml = await loadFixture("whiskyadvocate", "review-page.html");
  const $ = cheerio(issueHtml);
  const issueNames = $("select")
    .filter(
      (_, element) =>
        element.attribs.name === "filters[default][custom_rating_issue][]",
    )
    .find("option")
    .toArray()
    .flatMap((element) => {
      const value = $(element).text().trim();
      return element.attribs.value === "" || !value ? [] : [value];
    });
  const observations: ScraperObservation<WhiskyAdvocateObservation>[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname !== "/ratings-reviews"
        ? articleHtml
        : url.search.includes("custom_rating_issue")
          ? reviewHtml
          : issueHtml,
  }));
  const checkpoint = vi.fn();
  const session: ScraperSession<
    WhiskyAdvocateCursor,
    WhiskyAdvocateObservation
  > = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint,
    remainingRequests: () => 200,
  };

  await whiskyAdvocateAdapter({ cursor: null, session });

  expect(request).toHaveBeenCalledTimes(168);
  expect(
    request.mock.calls[1]?.[0].url.searchParams.get("custom_rating_issue[0]"),
  ).toBe(issueNames[0]);
  expect(observations).toHaveLength(166);
  expect(observations[0]).toMatchObject({
    sourceKey:
      "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
    value: {
      article: {
        canonicalUrl:
          "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
        title:
          "Angel’s Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1), 57.2%",
        issue: "Winter 2023",
        publishedAt: new Date("2023-12-19T00:00:00.000Z"),
        contentHash: expect.any(String),
        reviews: [
          {
            sourceKey:
              "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
            name: "Angel’s Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1), 57.2%",
            category: "rye",
            nativeScore: { value: 94, scale: 100, display: "94/100" },
            normalizedRating: 94,
          },
        ],
      },
      reviewTexts: {},
    },
  });
  expect(checkpoint).toHaveBeenCalledTimes(166);
  expect(checkpoint).toHaveBeenLastCalledWith({
    issue: "Winter 2023",
    processedReviewUrls: observations.map(({ sourceKey }) => sourceKey),
  });
});

test("resumes the same issue after the last stored review", async () => {
  const reviewHtml = await loadFixture("whiskyadvocate", "bottle-list.html");
  const articleHtml = await loadFixture("whiskyadvocate", "review-page.html");
  const reviews = parseReviews(
    reviewHtml,
    "https://whiskyadvocate.com/ratings-reviews",
  );
  const processedReviewUrls = reviews.slice(0, -1).map((review) => review.url);
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/ratings-reviews" ? reviewHtml : articleHtml,
  }));
  const session: ScraperSession<
    WhiskyAdvocateCursor,
    WhiskyAdvocateObservation
  > = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 20,
  };

  await whiskyAdvocateAdapter({
    cursor: { issue: "Winter 2023", processedReviewUrls },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  expect(emit).toHaveBeenCalledOnce();
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: reviews.at(-1)?.url }),
  );
  expect(checkpoint).toHaveBeenCalledWith({
    issue: "Winter 2023",
    processedReviewUrls: reviews.map((review) => review.url),
  });
});

test("fails when the newest issue has no review results", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const request = vi.fn(async () => ({
    url: new URL("https://whiskyadvocate.com/ratings-reviews"),
    status: 200,
    headers: {},
    body: issueHtml,
  }));
  const session: ScraperSession<
    WhiskyAdvocateCursor,
    WhiskyAdvocateObservation
  > = {
    request,
    emit: vi.fn(),
    checkpoint: vi.fn(),
    remainingRequests: () => 2,
  };

  await expect(
    whiskyAdvocateAdapter({ cursor: null, session }),
  ).rejects.toThrow("Whisky Advocate issue contains no reviews.");
});
