import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperObservation, ScraperSession } from "../types";
import {
  discoverLatestWhiskyfunArchive,
  discoverOlderWhiskyfunArchive,
  discoverWhiskyfunArchiveArticles,
  discoverWhiskyfunArticles,
  parseWhiskyfunArticle,
  whiskyfunAdapter,
  WhiskyfunCursorSchema,
  type WhiskyfunCursor,
  type WhiskyfunObservation,
} from "./whiskyfun";

const FIRST_URL =
  "https://www.whiskyfun.com/2026/A-wee-trainload-of-a-dozen-secret-Speysiders.html";
const SECOND_URL = "https://www.whiskyfun.com/2026/A-trio-of-Dailuaine.html";
const ARCHIVE_URL =
  "https://www.whiskyfun.com/archivejanuary25-1-Longmorn-Linkwood.html";
const OLDER_ARCHIVE_URL =
  "https://www.whiskyfun.com/archivedecember24-2-Lagavulin-Brora.html";
const COMPLETED_HISTORY: Pick<
  WhiskyfunCursor,
  "nextArchiveUrl" | "processedArchiveArticleUrls" | "historyComplete"
> = {
  nextArchiveUrl: null,
  processedArchiveArticleUrls: [],
  historyComplete: true,
};

function archivePage({ older = true }: { older?: boolean } = {}) {
  return `<html><head><meta name="author" content="Archive Reviewer"></head><body>
    <a name="020125"></a><font>January 2, 2025</font>
    <p class="textetresgrandfoncegrasCopie">Two archive whiskies</p>
    <table><tr><td class="TextenormalNEW"><span class="textegrandfoncegras">Archive Malt 10 yo (46%, Sample Bottler)</span> Notes. SGP: 551 – 88 points.</td></tr></table>
    <a name="010125"></a><font>January 1, 2025</font>
    <p class="textetresgrandfoncegrasCopie">First rum session</p>
    <table><tr><td class="TextenormalNEW"><span class="textegrandfoncegras">Archive Rum 10 yo (46%, Sample Bottler)</span> Notes. SGP: 551 - 85 points.</td></tr></table>
    ${older ? `<a href="${OLDER_ARCHIVE_URL}">December 2024 - part 2</a>` : ""}
    <a href="https://www.whiskyfun.com/archivejanuary25-2-Caperdonich-Mortlach.html">January 2025 - part 2</a>
  </body></html>`;
}

test("discovers at most twenty current whisky articles", async () => {
  const feed = await loadFixture("whiskyfun", "feed.xml");
  const expandedFeed = feed.replace(
    "</channel>",
    Array.from(
      { length: 20 },
      (_, index) =>
        `<item><title>Whisky article ${index}</title><link>https://www.whiskyfun.com/2026/Whisky-article-${index}.html</link><pubDate>Wed, 19 Aug 2026 08:49:00 +0200</pubDate></item>`,
    ).join("") + "</channel>",
  );

  expect(discoverWhiskyfunArticles(feed)).toEqual([
    {
      canonicalUrl: FIRST_URL,
      title: "A wee trainload of a dozen secret Speysiders",
      publishedAt: new Date("2026-08-20T06:21:00.000Z"),
    },
    {
      canonicalUrl: SECOND_URL,
      title: "A trio of Dailuaine",
      publishedAt: new Date("2026-08-19T06:49:00.000Z"),
    },
  ]);
  expect(discoverWhiskyfunArticles(expandedFeed)).toHaveLength(19);
  expect(discoverWhiskyfunArticles(expandedFeed).at(-1)?.title).toBe(
    "Whisky article 16",
  );
});

test("extracts scored reviews with stable source keys", async () => {
  const html = await loadFixture("whiskyfun", "article.html");
  const article = {
    canonicalUrl: SECOND_URL,
    title: "A trio of Dailuaine",
    publishedAt: new Date("2026-08-19T06:49:00.000Z"),
  };
  const parsed = parseWhiskyfunArticle(html, article);
  const reparsed = parseWhiskyfunArticle(
    html.replaceAll("Dailuaine 5 yo", "Dailuaine   5 yo"),
    article,
  );
  if (!parsed || !reparsed) throw new Error("Expected scored reviews.");

  expect(parsed.article).toMatchObject({
    canonicalUrl: SECOND_URL,
    title: "A trio of Dailuaine",
    publishedAt: new Date("2026-08-19T06:49:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Dailuaine 5 yo 2020/2025 (61%, Sample Bottler, cask #1)",
        reviewerName: "Serge Valentin",
        nativeScore: { value: 87, scale: 100, display: "87 points" },
        normalizedRating: 87,
      },
      {
        name: "Dailuaine 23 yo 2002/2025 (57%, Sample Bottler, cask #2)",
        reviewerName: "Serge Valentin",
        nativeScore: { value: 89, scale: 100, display: "89 points" },
        normalizedRating: 89,
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
    "Unscored introduction",
  );
});

test("discovers the newest archive and the next older linked page", () => {
  const index = `<a href="archiveapril25-2-Aberlour.html">April part 2</a>
    <a href="archivemay25-1-Linkwood.html">May part 1</a>
    <a href="archiveavril25-1-Benrinnes.html">April part 1</a>
    <a href="https://example.com/archivejune25-1-Other.html">Other site</a>`;

  expect(discoverLatestWhiskyfunArchive(index)?.href).toBe(
    "https://www.whiskyfun.com/archivemay25-1-Linkwood.html",
  );
  expect(
    discoverOlderWhiskyfunArchive(archivePage(), new URL(ARCHIVE_URL))?.href,
  ).toBe(OLDER_ARCHIVE_URL);
});

test("splits archive dates and excludes a non-whisky session", () => {
  const discovered = discoverWhiskyfunArchiveArticles(
    archivePage(),
    new URL(ARCHIVE_URL),
  );

  expect(
    discovered.map(({ article }) => ({
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      publishedAt: article.publishedAt,
      reviewerName: article.reviewerName,
    })),
  ).toEqual([
    {
      canonicalUrl: `${ARCHIVE_URL}#020125`,
      title: "Two archive whiskies",
      publishedAt: new Date("2025-01-02T00:00:00.000Z"),
      reviewerName: "Archive Reviewer",
    },
    {
      canonicalUrl: `${ARCHIVE_URL}#010125`,
      title: "First rum session",
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      reviewerName: "Archive Reviewer",
    },
  ]);

  const whisky = parseWhiskyfunArticle(
    discovered[0]!.body,
    discovered[0]!.article,
  );
  expect(whisky?.article.reviews).toEqual([
    expect.objectContaining({
      name: "Archive Malt 10 yo (46%, Sample Bottler)",
      reviewerName: "Archive Reviewer",
      nativeScore: { value: 88, scale: 100, display: "88 points" },
      normalizedRating: 88,
    }),
  ]);
  expect(
    parseWhiskyfunArticle(discovered[1]!.body, discovered[1]!.article),
  ).toBeNull();
});

test("accepts a current-only cursor and adds history defaults", () => {
  expect(
    WhiskyfunCursorSchema.parse({ processedArticleUrls: [FIRST_URL] }),
  ).toEqual({
    processedArticleUrls: [FIRST_URL],
    nextArchiveUrl: null,
    processedArchiveArticleUrls: [],
    historyComplete: false,
  });
});

test("returns no observation for an editorial feed item", () => {
  expect(
    parseWhiskyfunArticle(
      '<table><tr><td class="TextenormalNEW">Publisher anniversary article.</td></tr></table>',
      {
        canonicalUrl:
          "https://www.whiskyfun.com/2026/Publisher-anniversary.html",
        title: "Publisher anniversary",
        publishedAt: new Date("2026-08-18T00:00:00.000Z"),
      },
    ),
  ).toBeNull();
});

test("rejects a review-shaped article without a score", () => {
  expect(() =>
    parseWhiskyfunArticle(
      '<table><tr><td class="TextenormalNEW"><span class="textegrandfoncegras">Example 10 yo (46%, Sample Bottler)</span></td></tr></table>',
      {
        canonicalUrl: "https://www.whiskyfun.com/2026/Example-review.html",
        title: "Example review",
        publishedAt: new Date("2026-08-18T00:00:00.000Z"),
      },
    ),
  ).toThrow("Whiskyfun article contains no scored reviews.");
});

test("checkpoints an editorial item and continues to reviews", async () => {
  const editorialUrl =
    "https://www.whiskyfun.com/2026/Publisher-anniversary.html";
  const feed = `<?xml version="1.0"?><rss><channel>
    <item><title>Publisher anniversary</title><link>${editorialUrl}</link><pubDate>Tue, 18 Aug 2026 00:00:00 GMT</pubDate></item>
    <item><title>A trio of Dailuaine</title><link>${SECOND_URL}</link><pubDate>Wed, 19 Aug 2026 08:49:00 +0200</pubDate></item>
  </channel></rss>`;
  const review = await loadFixture("whiskyfun", "article.html");
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/whatsnew.xml"
        ? feed
        : url.href === editorialUrl
          ? '<table><tr><td class="TextenormalNEW">Publisher anniversary article.</td></tr></table>'
          : review,
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: { processedArticleUrls: [], ...COMPLETED_HISTORY },
    session,
  });

  expect(emit).toHaveBeenCalledTimes(1);
  expect(
    checkpoint.mock.calls.map(([cursor]) => cursor.processedArticleUrls),
  ).toEqual([[editorialUrl], [editorialUrl, SECOND_URL]]);
});

test("resumes without requesting a completed article", async () => {
  const feed = await loadFixture("whiskyfun", "feed.xml");
  const html = await loadFixture("whiskyfun", "article.html");
  const observations: ScraperObservation<WhiskyfunObservation>[] = [];
  const checkpoints: WhiskyfunCursor[] = [];
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/whatsnew.xml" ? feed : html,
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit: async (observation) => {
      observations.push(observation);
    },
    checkpoint: async (nextCursor) => {
      checkpoints.push(nextCursor);
    },
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: {
      processedArticleUrls: [FIRST_URL],
      ...COMPLETED_HISTORY,
    },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskyfun.com/whatsnew.xml",
    SECOND_URL,
  ]);
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({
    sourceKey: SECOND_URL,
    itemCount: 2,
  });
  expect(
    checkpoints.map(({ processedArticleUrls }) => processedArticleUrls),
  ).toEqual([[FIRST_URL, SECOND_URL]]);
});

test("drops completed URLs that leave the current feed window", async () => {
  const html = await loadFixture("whiskyfun", "article.html");
  const priorUrls = Array.from(
    { length: 20 },
    (_, index) => `https://www.whiskyfun.com/2026/Prior-${index}.html`,
  );
  const currentUrls = [
    "https://www.whiskyfun.com/2026/New-review.html",
    ...priorUrls.slice(0, -1),
  ];
  const feed = `<?xml version="1.0"?><rss><channel>${currentUrls
    .map(
      (url, index) =>
        `<item><title>Review ${index}</title><link>${url}</link><pubDate>Wed, 19 Aug 2026 08:49:00 +0200</pubDate></item>`,
    )
    .join("")}</channel></rss>`;
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/whatsnew.xml" ? feed : html,
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit: vi.fn(),
    checkpoint,
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: { processedArticleUrls: priorUrls, ...COMPLETED_HISTORY },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  const completedUrls = checkpoint.mock.calls.at(-1)?.[0].processedArticleUrls;
  expect(completedUrls).toHaveLength(20);
  expect(new Set(completedUrls)).toEqual(new Set(currentUrls));
});

test("checks current reviews, imports one archive page, and advances", async () => {
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/whatsnew.xml"
        ? '<?xml version="1.0"?><rss><channel></channel></rss>'
        : url.pathname === "/"
          ? `<a href="${ARCHIVE_URL}">January 2025 - part 1</a>`
          : archivePage(),
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({ cursor: null, session });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.whiskyfun.com/whatsnew.xml",
    "https://www.whiskyfun.com/",
    ARCHIVE_URL,
  ]);
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceKey: `${ARCHIVE_URL}#020125`,
      itemCount: 1,
    }),
  );
  expect(checkpoint.mock.calls.at(-1)?.[0]).toEqual({
    processedArticleUrls: [],
    nextArchiveUrl: OLDER_ARCHIVE_URL,
    processedArchiveArticleUrls: [],
    historyComplete: false,
  });
});

test("resumes within an archive page and records the archive end", async () => {
  const completedUrl = `${ARCHIVE_URL}#020125`;
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/whatsnew.xml"
        ? '<?xml version="1.0"?><rss><channel></channel></rss>'
        : archivePage({ older: false }),
  }));
  const session: ScraperSession<WhiskyfunCursor, WhiskyfunObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 30,
  };

  await whiskyfunAdapter({
    cursor: {
      processedArticleUrls: [],
      nextArchiveUrl: ARCHIVE_URL,
      processedArchiveArticleUrls: [completedUrl],
      historyComplete: false,
    },
    session,
  });

  expect(request).toHaveBeenCalledTimes(2);
  expect(emit).not.toHaveBeenCalled();
  expect(checkpoint.mock.calls.at(-1)?.[0]).toEqual({
    processedArticleUrls: [],
    nextArchiveUrl: null,
    processedArchiveArticleUrls: [],
    historyComplete: true,
  });
});
