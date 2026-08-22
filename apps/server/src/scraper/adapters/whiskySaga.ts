import {
  normalizeReviewRating,
  type ReviewArticleIngestion,
  ReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";
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
const ARTICLE_PATH = /^\/blog\/[a-z0-9][a-z0-9-]*$/u;
const TASTING_PARAGRAPH = /^(?:Nose|Palate|Taste|Finish)\s*:/iu;
const SCORE = /^Score\s*:?\s*(?<value>\d{1,3}(?:[.,]\d+)?)\s*\/\s*100\s*$/iu;

export const WhiskySagaCursorSchema =
  currentReviewCursorSchema(MAX_CURRENT_ARTICLES);

export const WhiskySagaObservationSchema = ReviewArticleIngestionSchema;

export type WhiskySagaCursor = z.infer<typeof WhiskySagaCursorSchema>;
export type WhiskySagaObservation = ReviewArticleIngestion;

const ArticleMetadataSchema = z
  .object({
    type: z.literal("Article"),
    datePublished: z.string().trim().min(1),
    author: z.string().trim().min(1),
  })
  .strict();

type ArticleMetadata = z.infer<typeof ArticleMetadataSchema>;

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

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function articleMetadata(data: string): ArticleMetadata | null {
  const $ = cheerio(data);
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(script).text());
    } catch {
      continue;
    }

    const values = Array.isArray(parsed) ? parsed : [parsed];
    for (const value of values) {
      const metadata = objectValue(value);
      const rawAuthor = metadata?.author;
      const author =
        typeof rawAuthor === "string"
          ? rawAuthor
          : objectValue(rawAuthor)?.name;
      const result = ArticleMetadataSchema.safeParse({
        type: metadata?.["@type"],
        datePublished: metadata?.datePublished,
        author,
      });
      if (result.success) return result.data;
    }
  }
  return null;
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
    normalizedRating: normalizeReviewRating(nativeScore),
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
  const metadata = articleMetadata(data);
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
    normalizedRating: score.normalizedRating,
  };
  const contentText = JSON.stringify({ review, reviewText });

  return WhiskySagaObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews: [review],
    },
    reviewTexts: { [reviewSourceKey]: reviewText },
  });
}

export const whiskySagaAdapter: ScraperAdapter<
  WhiskySagaCursor,
  WhiskySagaObservation
> = async ({ cursor, session }) => {
  const indexResponse = await session.request({
    target: TARGET,
    url: new URL("/blog/category/Scotland", ORIGIN),
  });
  const articleUrls = discoverWhiskySagaArticles(indexResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) => parseWhiskySagaArticle(response.body, response.url),
  });
};
