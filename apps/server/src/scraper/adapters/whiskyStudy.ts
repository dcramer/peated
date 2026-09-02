import {
  type ExternalReviewArticleIngestion,
  ExternalReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { ScraperAdapter } from "../types";
import { parseArticleMetadata } from "./articleMetadata";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";
import { parseDate } from "./dates";

// This adapter owns The Whisky Study parsing. The shared scraper runtime owns
// every remote request and the shared review sink owns storage.
const ORIGIN = "https://thewhiskystudy.com";
const TARGET = "whiskystudy";
const MAX_CURRENT_ARTICLES = 20;
const ARTICLE_PATH = /^\/reviews-3\/[a-z0-9][a-z0-9-]*$/u;
const TASTING_PARAGRAPH = /^(?:Nose|Palate|Taste|Finish)\s*:/iu;
const SCORE =
  /^Score\s*:\s*(?<value>\d{1,3}(?:[.,]\d+)?)(?:\s*\/\s*100)?\s*$/iu;

export const WhiskyStudyCursorSchema =
  currentReviewCursorSchema(MAX_CURRENT_ARTICLES);

export const WhiskyStudyObservationSchema =
  ExternalReviewArticleIngestionSchema;

export type WhiskyStudyCursor = z.infer<typeof WhiskyStudyCursorSchema>;
export type WhiskyStudyObservation = ExternalReviewArticleIngestion;

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

export function discoverWhiskyStudyArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();

  $("article.blog-item a[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_CURRENT_ARTICLES);
}

function bottleName(title: string): string | null {
  const name = normalizeText(title.replace(/\s+(?:Shelf\s+)?Review$/iu, ""));
  return name || null;
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
  return `whiskystudy:${digest}`;
}

export function parseWhiskyStudyArticle(
  data: string,
  rawCanonicalUrl: URL,
): WhiskyStudyObservation | null {
  const $ = cheerio(data);
  const article = $("article.h-entry").first();
  const paragraphs = article.find("p").toArray();
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
  if (!canonicalUrl) throw new Error("Invalid The Whisky Study article URL.");

  const title = normalizeText(article.find("h1.entry-title").first().text());
  const name = bottleName(title);
  const metadata = parseArticleMetadata(data);
  const score = article
    .find("h1,h2,h3,h4,p")
    .toArray()
    .map((element) => reviewScore($(element).text()))
    .find((value) => value !== null);
  const publishedAt = metadata ? parseDate(metadata.datePublished) : null;
  if (!title) throw new Error("The Whisky Study article title is missing.");
  if (!name) throw new Error("The Whisky Study Bottle name is missing.");
  if (!metadata?.author)
    throw new Error("The Whisky Study reviewer is missing.");
  if (!publishedAt)
    throw new Error("The Whisky Study article date is missing or invalid.");
  if (!score) throw new Error("The Whisky Study score is missing or invalid.");

  const reviewSourceKey = sourceKey(canonicalUrl.href);
  const review = {
    sourceKey: reviewSourceKey,
    name,
    category: null,
    reviewerName: metadata.author,
    nativeScore: score.nativeScore,
  };
  const contentText = JSON.stringify({ review, reviewText });

  return WhiskyStudyObservationSchema.parse({
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

export const whiskyStudyAdapter: ScraperAdapter<
  WhiskyStudyCursor,
  WhiskyStudyObservation
> = async ({ cursor, session }) => {
  const indexResponse = await session.request({
    target: TARGET,
    url: new URL("/reviews-3", ORIGIN),
  });
  const articleUrls = discoverWhiskyStudyArticles(indexResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) => parseWhiskyStudyArticle(response.body, response.url),
  });
};
