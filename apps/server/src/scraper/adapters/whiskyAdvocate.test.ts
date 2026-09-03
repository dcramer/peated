import { loadFixture } from "@peated/server/lib/test/fixtures";
import { load as cheerio } from "cheerio";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  type WhiskyAdvocateCursor,
  type WhiskyAdvocateObservation,
  parseIssueList,
  parseReviewBody,
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

test("starts old saved progress again and checks older issues later", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const reviewHtml = await loadFixture("whiskyadvocate", "bottle-list.html");
  const articleHtml = await loadFixture("whiskyadvocate", "review-page.html");
  const issueNames = parseIssueList(issueHtml);
  const $ = cheerio(reviewHtml);
  $("#directoryResults .postsItem").slice(1).remove();
  const oneReviewHtml = $.html();

  const run = async (cursor: WhiskyAdvocateCursor) => {
    const checkpoint = vi.fn();
    const request = vi.fn(async ({ url }: { url: URL }) => ({
      url,
      status: 200,
      headers: {},
      body:
        url.pathname !== "/ratings-reviews"
          ? articleHtml
          : url.search.includes("custom_rating_issue")
            ? oneReviewHtml
            : issueHtml,
    }));
    await whiskyAdvocateAdapter({
      cursor,
      session: {
        request,
        emit: vi.fn(),
        checkpoint,
        remainingRequests: () => 30,
      },
    });
    return { checkpoint, request };
  };

  const oldRun = await run({ processedIssues: [issueNames[0]!] });
  expect(
    oldRun.request.mock.calls[1]?.[0].url.searchParams.get(
      "custom_rating_issue[0]",
    ),
  ).toBe(issueNames[0]);

  const nextRun = await run({
    checksReviewDates: true,
    completedIssues: [issueNames[0]!],
    issue: null,
    completedReviewUrls: [],
  });
  expect(
    nextRun.request.mock.calls[1]?.[0].url.searchParams.get(
      "custom_rating_issue[0]",
    ),
  ).toBe(issueNames[1]);
  expect(nextRun.checkpoint).toHaveBeenLastCalledWith(
    expect.objectContaining({ completedIssues: issueNames.slice(0, 2) }),
  );
});

test("parses the publisher date template", async () => {
  const html = await loadFixture("whiskyadvocate", "review-page.html");

  expect(parseReviewPublishedAt(html)).toEqual(
    new Date("2023-12-19T00:00:00.000Z"),
  );
  expect(parseReviewBody(html)).toBe(
    "Nose: Vanilla and orchard fruit.\n\nPalate: Gentle oak. Finish: Long and dry.",
  );
  expect(() => parseReviewBody("<html></html>")).toThrow(
    "Whisky Advocate review body is missing.",
  );
  expect(() => parseReviewPublishedAt("<html></html>")).toThrow(
    "Whisky Advocate review date is missing.",
  );
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
  expect(Object.values(observations[0]!.value.externalReviewBodies)).toEqual([
    "Nose: Vanilla and orchard fruit.\n\nPalate: Gentle oak. Finish: Long and dry.",
  ]);
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
        externalReviews: [
          {
            sourceKey:
              "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
            name: "Angel’s Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1), 57.2%",
            category: "rye",
            nativeScore: { value: 94, scale: 100, display: "94/100" },
          },
        ],
      },
    },
  });
  expect(checkpoint).toHaveBeenCalledTimes(167);
  expect(checkpoint).toHaveBeenLastCalledWith({
    checksReviewDates: true,
    completedIssues: ["Winter 2023"],
    issue: null,
    completedReviewUrls: [],
  });
});

test("rechecks old saved reviews and resumes reviews checked for dates", async () => {
  const issueHtml = await loadFixture("whiskyadvocate", "empty-search.html");
  const reviewHtml = await loadFixture("whiskyadvocate", "bottle-list.html");
  const articleHtml = await loadFixture("whiskyadvocate", "review-page.html");
  const $ = cheerio(reviewHtml);
  $("#directoryResults .postsItem").slice(2).remove();
  const twoReviewHtml = $.html();
  const externalReviews = parseReviews(
    twoReviewHtml,
    "https://whiskyadvocate.com/ratings-reviews",
  );
  const firstReviewUrl = externalReviews[0]!.url;

  const run = async (cursor: WhiskyAdvocateCursor) => {
    const emit = vi.fn();
    const checkpoint = vi.fn();
    const request = vi.fn(async ({ url }: { url: URL }) => ({
      url,
      status: 200,
      headers: {},
      body:
        url.pathname !== "/ratings-reviews"
          ? articleHtml
          : url.search.includes("custom_rating_issue")
            ? twoReviewHtml
            : issueHtml,
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
    await whiskyAdvocateAdapter({ cursor, session });
    return { checkpoint, emit, request };
  };

  const oldRun = await run({
    issue: "Winter 2023",
    processedReviewUrls: [firstReviewUrl],
  });
  expect(oldRun.request).toHaveBeenCalledTimes(4);
  expect(oldRun.emit).toHaveBeenCalledTimes(2);

  const datedRun = await run({
    checksReviewDates: true,
    completedIssues: [],
    issue: "Winter 2023",
    completedReviewUrls: [firstReviewUrl],
  });
  expect(datedRun.request).toHaveBeenCalledTimes(3);
  expect(datedRun.emit).toHaveBeenCalledOnce();
  expect(datedRun.emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: externalReviews.at(-1)?.url }),
  );
  expect(datedRun.checkpoint).toHaveBeenCalledWith({
    checksReviewDates: true,
    completedIssues: [],
    issue: "Winter 2023",
    completedReviewUrls: externalReviews.map((review) => review.url),
  });
  expect(datedRun.checkpoint).toHaveBeenLastCalledWith({
    checksReviewDates: true,
    completedIssues: ["Winter 2023"],
    issue: null,
    completedReviewUrls: [],
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
  ).rejects.toThrow("Whisky Advocate issue contains no external reviews.");
});
