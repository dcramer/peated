import {
  type ExternalReviewArticleIngestion,
  ExternalReviewArticleIngestionSchema,
  type ExternalReviewArticleObservation,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter, ScraperSession } from "../types";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";
import { parseDate } from "./dates";

const ORIGIN = "https://www.whiskyfun.com";
const TARGET = "whiskyfun";
const MAX_FEED_ITEMS = 20;
const MAX_ARCHIVE_ARTICLES = 40;
const ARTICLE_PATH = /^\/\d{4}\/[^/]+\.html$/;
const ARCHIVE_PATH =
  /^\/archive(january|february|march|april|avril|may|june|july|august|september|october|november|december)(\d{2})-([12])(?:-[^/]+)?\.html$/i;
const DATE_ANCHOR = /^\d{6}$/;
const DATE_ANCHOR_TAG = /<a\b[^>]*\bname\s*=\s*["'](\d{6})["'][^>]*>/giu;
const SESSION_TITLE_SELECTOR = ".textetresgrandfoncegrasCopie";
const NON_WHISKY_TITLE =
  /\b(?:armagnacs?|brand(?:y|ies)|calvados|cognacs?|mezcal|rums?|tequilas?)\b/iu;

const WhiskyfunFeedArticleSchema = z
  .object({
    canonicalUrl: z.url(),
    title: z.string().trim().min(1).max(1000),
    publishedAt: z.date(),
    reviewerName: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .strict();

export const WhiskyfunCursorSchema = currentReviewCursorSchema(
  MAX_FEED_ITEMS,
).extend({
  nextArchiveUrl: z.url().nullable().default(null),
  processedArchiveArticleUrls: z
    .array(z.url())
    .max(MAX_ARCHIVE_ARTICLES)
    .default([]),
  historyComplete: z.boolean().default(false),
});

export const WhiskyfunObservationSchema = ExternalReviewArticleIngestionSchema;

export type WhiskyfunCursor = z.infer<typeof WhiskyfunCursorSchema>;
export type WhiskyfunObservation = ExternalReviewArticleIngestion;
type WhiskyfunFeedArticle = z.infer<typeof WhiskyfunFeedArticleSchema>;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function articleUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.search = "";
    if (url.origin !== ORIGIN) return null;
    if (ARTICLE_PATH.test(url.pathname)) {
      url.hash = "";
      return url;
    }
    if (
      ARCHIVE_PATH.test(url.pathname) &&
      DATE_ANCHOR.test(url.hash.slice(1))
    ) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function archivePageUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    if (url.origin !== ORIGIN || !ARCHIVE_PATH.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

type ArchivePeriod = {
  year: number;
  month: number;
  part: number;
};

interface ArchiveMonths {
  [name: string]: number;
}

const ARCHIVE_MONTHS: ArchiveMonths = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  avril: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function archivePeriod(url: URL): ArchivePeriod {
  const match = ARCHIVE_PATH.exec(url.pathname);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error("Invalid Whiskyfun archive URL.");
  }
  return {
    year: 2000 + Number(match[2]),
    month: ARCHIVE_MONTHS[match[1].toLocaleLowerCase("en")] ?? 0,
    part: Number(match[3]),
  };
}

function compareArchivePeriods(left: URL, right: URL): number {
  const a = archivePeriod(left);
  const b = archivePeriod(right);
  return a.year - b.year || a.month - b.month || a.part - b.part;
}

function discoverArchiveLinks(data: string): URL[] {
  const $ = cheerio(data);
  const links = new Map<string, URL>();
  $("a[href]").each((_, element) => {
    const url = archivePageUrl($(element).attr("href") ?? "");
    if (url) links.set(url.href, url);
  });
  return [...links.values()];
}

export function discoverLatestWhiskyfunArchive(data: string): URL | null {
  return discoverArchiveLinks(data).sort(compareArchivePeriods).at(-1) ?? null;
}

export function discoverOlderWhiskyfunArchive(
  data: string,
  rawCurrentUrl: URL,
): URL | null {
  const currentUrl = archivePageUrl(rawCurrentUrl.href);
  if (!currentUrl) throw new Error("Invalid current Whiskyfun archive URL.");
  return (
    discoverArchiveLinks(data)
      .filter((url) => compareArchivePeriods(url, currentUrl) < 0)
      .sort(compareArchivePeriods)
      .at(-1) ?? null
  );
}

function publishedAtFromAnchor(anchor: string): Date | null {
  if (!DATE_ANCHOR.test(anchor)) return null;
  const day = Number(anchor.slice(0, 2));
  const month = Number(anchor.slice(2, 4));
  const year = 2000 + Number(anchor.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

type WhiskyfunArchiveArticle = {
  article: WhiskyfunFeedArticle;
  body: string;
};

export function discoverWhiskyfunArchiveArticles(
  data: string,
  rawArchiveUrl: URL,
): WhiskyfunArchiveArticle[] {
  const archiveUrl = archivePageUrl(rawArchiveUrl.href);
  if (!archiveUrl) throw new Error("Invalid Whiskyfun archive URL.");

  const page = cheerio(data);
  const reviewerName =
    normalizeText(page('meta[name="author"]').first().attr("content") ?? "") ||
    null;
  const matches = [...data.matchAll(DATE_ANCHOR_TAG)];
  const articles: WhiskyfunArchiveArticle[] = [];

  for (const [index, match] of matches.entries()) {
    const anchor = match[1];
    const start = match.index;
    if (!anchor || start === undefined) continue;
    const publishedAt = publishedAtFromAnchor(anchor);
    if (!publishedAt) {
      throw new Error("Whiskyfun archive date anchor is invalid.");
    }

    const end = matches[index + 1]?.index ?? data.length;
    const body = data.slice(start, end);
    const section = cheerio(body);
    const title =
      section(SESSION_TITLE_SELECTOR)
        .toArray()
        .map((element) => normalizeText(section(element).text()))
        .find(Boolean) ||
      `Whiskyfun reviews for ${publishedAt.toISOString().slice(0, 10)}`;
    const canonicalUrl = new URL(archiveUrl);
    canonicalUrl.hash = anchor;

    articles.push({
      article: WhiskyfunFeedArticleSchema.parse({
        canonicalUrl: canonicalUrl.href,
        title,
        publishedAt,
        reviewerName,
      }),
      body,
    });
  }

  return articles;
}

export function discoverWhiskyfunArticles(
  data: string,
): WhiskyfunFeedArticle[] {
  const $ = cheerio(data, { xmlMode: true });
  const articles: WhiskyfunFeedArticle[] = [];

  for (const item of $("channel > item").slice(0, MAX_FEED_ITEMS)) {
    const title = normalizeText($(item).find("title").first().text());
    if (!title || NON_WHISKY_TITLE.test(title)) continue;

    const canonicalUrl = articleUrl($(item).find("link").first().text().trim());
    if (!canonicalUrl) {
      throw new Error("Whiskyfun feed article URL is invalid.");
    }

    const rawPublishedAt = normalizeText(
      $(item).find("pubDate").first().text(),
    );
    const publishedAt = parseDate(rawPublishedAt);
    if (!publishedAt) {
      throw new Error("Whiskyfun feed article date is invalid.");
    }

    articles.push(
      WhiskyfunFeedArticleSchema.parse({
        canonicalUrl: canonicalUrl.href,
        title,
        publishedAt,
      }),
    );
  }

  return articles;
}

function bottleName(value: string): string | null {
  const name = normalizeText(value);
  return /^.+\s+\((?=[^)]*\d{1,3}(?:[.,]\d+)?\s*(?:%|proof))[^)]*\)\s*$/iu.test(
    name,
  )
    ? name
    : null;
}

function score(value: string) {
  const match =
    /\bSGP:\s*\d{3}\s*[:\u2012-\u2015-]\s*(\d{1,3})\s+points?\b/iu.exec(value);
  const nativeValue = match?.[1] ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(nativeValue) || nativeValue < 0 || nativeValue > 100) {
    return null;
  }
  const nativeScore = {
    value: nativeValue,
    scale: 100,
    display: `${nativeValue} points`,
  };
  return {
    nativeScore,
  };
}

function reviewSourceKey(canonicalUrl: string, heading: string): string {
  const digest = createHash("sha256")
    .update(
      `${canonicalUrl}\n${normalizeText(heading).toLocaleLowerCase("en")}`,
    )
    .digest("hex");
  return `whiskyfun:${digest}`;
}

export function parseWhiskyfunArticle(
  data: string,
  feedArticle: WhiskyfunFeedArticle,
): WhiskyfunObservation | null {
  const article = WhiskyfunFeedArticleSchema.parse(feedArticle);
  const canonicalUrl = articleUrl(article.canonicalUrl);
  if (!canonicalUrl) throw new Error("Invalid Whiskyfun article URL.");

  const $ = cheerio(data);
  const reviewerName =
    article.reviewerName ??
    (normalizeText($('meta[name="author"]').first().attr("content") ?? "") ||
      null);
  const externalReviews: ExternalReviewArticleObservation["externalReviews"] =
    [];
  const externalReviewTexts: Record<string, string> = {};
  let hasReviewCandidate = false;
  let sessionTitle = article.title;

  $("*").each((_, element) => {
    if ($(element).is(SESSION_TITLE_SELECTOR)) {
      sessionTitle = normalizeText($(element).text()) || sessionTitle;
      return;
    }
    if (!$(element).is("td.TextenormalNEW")) return;
    if (NON_WHISKY_TITLE.test(sessionTitle)) return;

    const heading = $(element)
      .find(".textegrandfoncegras")
      .toArray()
      .map((candidate) => bottleName($(candidate).text()))
      .find((candidate) => candidate !== null);
    if (!heading) return;
    hasReviewCandidate = true;

    const reviewText = normalizeText($(element).text());
    const reviewScore = score(reviewText);
    if (!reviewScore) return;

    const sourceKey = reviewSourceKey(canonicalUrl.href, heading);
    externalReviews.push({
      sourceKey,
      name: heading,
      category: null,
      reviewerName,
      nativeScore: reviewScore.nativeScore,
    });
    externalReviewTexts[sourceKey] = reviewText;
  });

  if (externalReviews.length === 0) {
    if (!hasReviewCandidate) return null;
    throw new Error("Whiskyfun article contains no scored external reviews.");
  }

  const contentText = Object.values(externalReviewTexts).join("\n");
  return WhiskyfunObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title: article.title,
      issue: null,
      publishedAt: article.publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      externalReviews,
    },
    externalReviewTexts,
  });
}

export const whiskyfunAdapter: ScraperAdapter<
  WhiskyfunCursor,
  WhiskyfunObservation
> = async ({ cursor, session }) => {
  let nextCursor = WhiskyfunCursorSchema.parse(
    cursor ?? { processedArticleUrls: [] },
  );
  const feedResponse = await session.request({
    target: TARGET,
    url: new URL("/whatsnew.xml", ORIGIN),
  });
  const articles = discoverWhiskyfunArticles(feedResponse.body);
  const currentSession: ScraperSession<
    { processedArticleUrls: string[] },
    WhiskyfunObservation
  > = {
    request: (request) => session.request(request),
    emit: (observation) => session.emit(observation),
    remainingRequests: () => session.remainingRequests(),
    checkpoint: async ({ processedArticleUrls }) => {
      nextCursor = { ...nextCursor, processedArticleUrls };
      await session.checkpoint(nextCursor);
    },
  };
  await processCurrentReviews({
    target: TARGET,
    articles,
    articleUrl: (article) => new URL(article.canonicalUrl),
    cursor: nextCursor,
    session: currentSession,
    parse: (response, article) => parseWhiskyfunArticle(response.body, article),
  });

  if (nextCursor.historyComplete) return;

  if (!nextCursor.nextArchiveUrl) {
    const indexResponse = await session.request({
      target: TARGET,
      url: new URL("/", ORIGIN),
    });
    const latestArchive = discoverLatestWhiskyfunArchive(indexResponse.body);
    if (!latestArchive) {
      throw new Error("Whiskyfun archive index contains no archive pages.");
    }
    nextCursor = {
      ...nextCursor,
      nextArchiveUrl: latestArchive.href,
      processedArchiveArticleUrls: [],
    };
    await session.checkpoint(nextCursor);
  }

  const archiveCursorUrl = nextCursor.nextArchiveUrl;
  if (!archiveCursorUrl) {
    throw new Error("Whiskyfun archive cursor URL is missing.");
  }
  const archiveUrl = archivePageUrl(archiveCursorUrl);
  if (!archiveUrl) throw new Error("Invalid Whiskyfun archive cursor URL.");
  const archiveResponse = await session.request({
    target: TARGET,
    url: archiveUrl,
  });
  const archiveArticles = discoverWhiskyfunArchiveArticles(
    archiveResponse.body,
    archiveUrl,
  );
  if (archiveArticles.length === 0) {
    throw new Error("Whiskyfun archive contains no dated articles.");
  }

  const archiveArticleUrls = new Set(
    archiveArticles.map(({ article }) => article.canonicalUrl),
  );
  const processedArchiveArticleUrls = new Set(
    nextCursor.processedArchiveArticleUrls.filter((url) =>
      archiveArticleUrls.has(url),
    ),
  );
  for (const { article, body } of archiveArticles) {
    if (processedArchiveArticleUrls.has(article.canonicalUrl)) continue;
    const observation = parseWhiskyfunArticle(body, article);
    if (observation) {
      await session.emit({
        sourceKey: observation.article.canonicalUrl,
        itemCount: observation.article.externalReviews.length,
        value: observation,
      });
    }
    processedArchiveArticleUrls.add(article.canonicalUrl);
    nextCursor = {
      ...nextCursor,
      processedArchiveArticleUrls: [...processedArchiveArticleUrls],
    };
    await session.checkpoint(nextCursor);
  }

  const olderArchive = discoverOlderWhiskyfunArchive(
    archiveResponse.body,
    archiveUrl,
  );
  nextCursor = {
    ...nextCursor,
    nextArchiveUrl: olderArchive?.href ?? null,
    processedArchiveArticleUrls: [],
    historyComplete: olderArchive === null,
  };
  await session.checkpoint(nextCursor);
};
