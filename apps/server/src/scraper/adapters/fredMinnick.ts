import {
  type ReviewArticleIngestion,
  ReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { ScraperAdapter } from "../types";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";
import { parseDate } from "./dates";

// This adapter owns Fred Minnick parsing. The shared scraper runtime owns
// every remote request and the shared review sink owns storage.
const ORIGIN = "https://www.fredminnick.com";
const TARGET = "fredminnick";
const MAX_CURRENT_ARTICLES = 5;
const MAX_CURRENT_SITEMAPS = 2;
const POST_SITEMAP_PATH = /^\/post-sitemap(?<page>\d*)\.xml$/u;
const ARTICLE_PATH =
  /^\/(?<year>\d{4})\/(?<month>\d{2})\/(?<day>\d{2})\/(?<slug>(?:review|bourbon-review|whiskey-review)-[a-z0-9][a-z0-9-]*)\/$/u;
const REVIEW_TITLE =
  /^(?:Review|Bourbon Review|Whiskey Review):\s*(?<name>[^,]+)$/iu;
const TASTING_TEXT =
  /\b(?:aroma|finish|flavou?r|nose|nosing|notes?|palate|sip|taste|tasting notes?)\b/iu;

export const FredMinnickCursorSchema =
  currentReviewCursorSchema(MAX_CURRENT_ARTICLES);

export const FredMinnickObservationSchema = ReviewArticleIngestionSchema;

export type FredMinnickCursor = z.infer<typeof FredMinnickCursorSchema>;
export type FredMinnickObservation = ReviewArticleIngestion;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function sourceUrl(value: string, pattern: RegExp): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/") && !url.pathname.endsWith(".xml")) {
      url.pathname += "/";
    }
    if (url.origin !== ORIGIN || !pattern.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

function sitemapPage(url: URL): number {
  const page = POST_SITEMAP_PATH.exec(url.pathname)?.groups?.page;
  return page ? Number(page) : 1;
}

export function discoverFredMinnickPostSitemaps(data: string): URL[] {
  const $ = cheerio(data, { xmlMode: true });
  const sitemaps = new Map<string, URL>();

  $("sitemap > loc").each((_, element) => {
    const url = sourceUrl($(element).text(), POST_SITEMAP_PATH);
    if (url) sitemaps.set(url.href, url);
  });

  return [...sitemaps.values()]
    .sort((left, right) => sitemapPage(left) - sitemapPage(right))
    .slice(-MAX_CURRENT_SITEMAPS);
}

export function discoverFredMinnickArticles(
  sitemaps: readonly string[],
): URL[] {
  const articles = new Map<string, URL>();

  for (const data of sitemaps) {
    const $ = cheerio(data, { xmlMode: true });
    $("url > loc").each((_, element) => {
      const url = sourceUrl($(element).text(), ARTICLE_PATH);
      if (url) articles.set(url.href, url);
    });
  }

  return [...articles.values()]
    .sort((left, right) => right.pathname.localeCompare(left.pathname))
    .slice(0, MAX_CURRENT_ARTICLES);
}

function bottleName(title: string): string | null {
  const match = REVIEW_TITLE.exec(normalizeText(title));
  const name = normalizeText(match?.groups?.name ?? "");
  return name || null;
}

function sourceKey(canonicalUrl: string): string {
  const digest = createHash("sha256").update(canonicalUrl).digest("hex");
  return `fredminnick:${digest}`;
}

export function parseFredMinnickArticle(
  data: string,
  rawCanonicalUrl: URL,
): FredMinnickObservation | null {
  const $ = cheerio(data);
  const canonicalUrl = sourceUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
    ARTICLE_PATH,
  );
  if (!canonicalUrl) throw new Error("Invalid Fred Minnick article URL.");

  const title = normalizeText($("p.text__paragraph.m-t.m-b").first().text());
  const name = bottleName(title);
  const rawPublishedAt = normalizeText($("p.date-label").first().text());
  const publishedAt = parseDate(rawPublishedAt);
  if (!title) throw new Error("Fred Minnick article title is missing.");
  if (title.includes(",")) return null;
  if (!name)
    throw new Error("Fred Minnick Bottle name is missing or ambiguous.");
  if (!rawPublishedAt || !publishedAt) {
    throw new Error("Fred Minnick article date is missing or invalid.");
  }

  const reviewText = normalizeText(
    $(".rich-text-block-4")
      .first()
      .children("p.wp-block-paragraph")
      .toArray()
      .map((element) => normalizeText($(element).text()))
      .filter((text) => TASTING_TEXT.test(text) && !/^Read more:/iu.test(text))
      .join(" "),
  );
  const reviewSourceKey = sourceKey(canonicalUrl.href);
  const review = {
    sourceKey: reviewSourceKey,
    name,
    category: null,
    reviewerName: "Fred Minnick",
    nativeScore: null,
    normalizedRating: null,
  };
  const contentText = JSON.stringify({
    review,
    reviewText: reviewText || null,
  });

  return FredMinnickObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews: [review],
    },
    reviewTexts: reviewText ? { [reviewSourceKey]: reviewText } : {},
  });
}

export const fredMinnickAdapter: ScraperAdapter<
  FredMinnickCursor,
  FredMinnickObservation
> = async ({ cursor, session }) => {
  const indexResponse = await session.request({
    target: TARGET,
    url: new URL("/sitemap_index.xml", ORIGIN),
  });
  const sitemapUrls = discoverFredMinnickPostSitemaps(indexResponse.body);
  const sitemapBodies: string[] = [];
  for (const url of sitemapUrls) {
    const response = await session.request({ target: TARGET, url });
    sitemapBodies.push(response.body);
  }
  const articleUrls = discoverFredMinnickArticles(sitemapBodies);

  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) => parseFredMinnickArticle(response.body, response.url),
  });
};
