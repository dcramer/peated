import {
  type ExternalReviewArticleIngestion,
  ExternalReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter, ScraperSession } from "../types";
import { parseArticleMetadata } from "./articleMetadata";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";
import { parseDate } from "./dates";

// This adapter owns Whisky Saga parsing. The shared scraper runtime owns every
// remote request and the shared review sink owns storage.
const ORIGIN = "https://www.whiskysaga.com";
const TARGET = "whiskysaga";
const MAX_CURRENT_ARTICLES = 20;
const MAX_HISTORY_ARTICLES = 20;
const ARTICLE_PATH = /^\/blog\/[a-z0-9][a-z0-9-]*$/u;
const HISTORY_OFFSET = /^\d{10,16}$/u;
const TASTING_PARAGRAPH = /^(?:Nose|Palate|Taste|Finish)\s*:/iu;
const SCORE = /^Score\s*:?\s*(?<value>\d{1,3}(?:[.,]\d+)?)\s*\/\s*100\s*$/iu;

export const WhiskySagaCursorSchema = currentReviewCursorSchema(
  MAX_CURRENT_ARTICLES,
).extend({
  nextHistoryUrl: z.url().nullable().default(null),
  processedHistoryArticleUrls: z
    .array(z.url())
    .max(MAX_HISTORY_ARTICLES)
    .default([]),
  historyComplete: z.boolean().default(false),
});

export const WhiskySagaObservationSchema = ExternalReviewArticleIngestionSchema;

export type WhiskySagaCursor = z.infer<typeof WhiskySagaCursorSchema>;
export type WhiskySagaObservation = ExternalReviewArticleIngestion;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function articleUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/$/u, "");
    if (url.origin !== ORIGIN || !ARTICLE_PATH.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function discoverWhiskySagaArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();

  $("article.blog-item a[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_CURRENT_ARTICLES);
}

function historyPageUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      url.pathname !== "/blog" ||
      url.hash ||
      url.searchParams.size !== 2 ||
      url.searchParams.get("category") !== "Scotland" ||
      !HISTORY_OFFSET.test(url.searchParams.get("offset") ?? "")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function discoverOlderWhiskySagaPage(data: string): URL | null {
  const $ = cheerio(data);
  return historyPageUrl(
    $(".older a[rel='next'][href]").first().attr("href") ?? "",
  );
}

function reviewScore(value: string) {
  const match = SCORE.exec(normalizeText(value));
  const rawValue = match?.groups?.value;
  const scoreValue = rawValue ? Number(rawValue.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100) {
    return null;
  }

  const nativeScore = {
    value: scoreValue,
    scale: 100,
    display: `${rawValue}/100`,
  };
  return {
    nativeScore,
  };
}

function sourceKey(canonicalUrl: string): string {
  const digest = createHash("sha256").update(canonicalUrl).digest("hex");
  return `whiskysaga:${digest}`;
}

export function parseWhiskySagaArticle(
  data: string,
  rawCanonicalUrl: URL,
): WhiskySagaObservation | null {
  const $ = cheerio(data);
  const article = $("article.h-entry").first();
  const paragraphs = article.find(".blog-item-content p").toArray();
  const reviewText = normalizeText(
    paragraphs
      .map((element) => normalizeText($(element).text()))
      .filter((text) => TASTING_PARAGRAPH.test(text))
      .join(" "),
  );
  if (!reviewText) return null;

  const canonicalUrl = articleUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
  );
  if (!canonicalUrl) throw new Error("Invalid Whisky Saga article URL.");

  const title = normalizeText(article.find("h1.entry-title").first().text());
  const metadata = parseArticleMetadata(data);
  const score = paragraphs
    .map((element) => reviewScore($(element).text()))
    .find((value) => value !== null);
  const publishedAt = metadata ? parseDate(metadata.datePublished) : null;
  if (!title) throw new Error("Whisky Saga article title is missing.");
  if (!metadata?.author) throw new Error("Whisky Saga reviewer is missing.");
  if (!publishedAt)
    throw new Error("Whisky Saga article date is missing or invalid.");
  if (!score) throw new Error("Whisky Saga score is missing or invalid.");

  const reviewSourceKey = sourceKey(canonicalUrl.href);
  const review = {
    sourceKey: reviewSourceKey,
    name: title,
    category: null,
    reviewerName: metadata.author,
    nativeScore: score.nativeScore,
  };
  const contentText = JSON.stringify({ review, reviewText });

  return WhiskySagaObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      externalReviews: [review],
    },
    externalReviewTexts: { [reviewSourceKey]: reviewText },
  });
}

export const whiskySagaAdapter: ScraperAdapter<
  WhiskySagaCursor,
  WhiskySagaObservation
> = async ({ cursor, session }) => {
  let nextCursor = WhiskySagaCursorSchema.parse(
    cursor ?? { processedArticleUrls: [] },
  );
  const indexResponse = await session.request({
    target: TARGET,
    url: new URL("/blog/category/Scotland", ORIGIN),
  });
  const articleUrls = discoverWhiskySagaArticles(indexResponse.body);
  const currentSession: ScraperSession<
    { processedArticleUrls: string[] },
    WhiskySagaObservation
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
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor: nextCursor,
    session: currentSession,
    parse: (response) => parseWhiskySagaArticle(response.body, response.url),
  });

  if (nextCursor.historyComplete) return;

  if (!nextCursor.nextHistoryUrl) {
    const olderPage = discoverOlderWhiskySagaPage(indexResponse.body);
    nextCursor = {
      ...nextCursor,
      nextHistoryUrl: olderPage?.href ?? null,
      processedHistoryArticleUrls: [],
      historyComplete: olderPage === null,
    };
    await session.checkpoint(nextCursor);
    if (!olderPage) return;
  }

  const historyUrl = historyPageUrl(nextCursor.nextHistoryUrl ?? "");
  if (!historyUrl) throw new Error("Invalid Whisky Saga history cursor URL.");
  const historyResponse = await session.request({
    target: TARGET,
    url: historyUrl,
  });
  const historyArticles = discoverWhiskySagaArticles(historyResponse.body);
  if (historyArticles.length === 0) {
    throw new Error("Whisky Saga history page contains no article cards.");
  }

  const historyArticleUrls = new Set(historyArticles.map((url) => url.href));
  const processedHistoryArticleUrls = new Set(
    nextCursor.processedHistoryArticleUrls.filter((url) =>
      historyArticleUrls.has(url),
    ),
  );
  for (const url of historyArticles) {
    if (processedHistoryArticleUrls.has(url.href)) continue;
    const response = await session.request({ target: TARGET, url });
    const observation = parseWhiskySagaArticle(response.body, response.url);
    if (observation) {
      await session.emit({
        sourceKey: observation.article.canonicalUrl,
        itemCount: observation.article.externalReviews.length,
        value: observation,
      });
    }
    processedHistoryArticleUrls.add(url.href);
    nextCursor = {
      ...nextCursor,
      processedHistoryArticleUrls: [...processedHistoryArticleUrls],
    };
    await session.checkpoint(nextCursor);
  }

  const olderPage = discoverOlderWhiskySagaPage(historyResponse.body);
  nextCursor = {
    ...nextCursor,
    nextHistoryUrl: olderPage?.href ?? null,
    processedHistoryArticleUrls: [],
    historyComplete: olderPage === null,
  };
  await session.checkpoint(nextCursor);
};
