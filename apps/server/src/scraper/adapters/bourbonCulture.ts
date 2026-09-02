import {
  type ExternalReviewArticleIngestion,
  ExternalReviewArticleIngestionSchema,
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

// This adapter owns Bourbon Culture parsing. The shared scraper runtime owns
// every remote request and the shared review sink owns storage.
const ORIGIN = "https://thebourbonculture.com";
const TARGET = "bourbonculture";
const MAX_CURRENT_ARTICLES = 6;
const ARTICLE_PATH = /^\/whiskey-reviews\/[a-z0-9][a-z0-9-]*\/$/u;
const TASTING_NOTE = /^(?:Nose|Palate|Finish)\s*:/iu;

export const BourbonCultureCursorSchema =
  currentReviewCursorSchema(MAX_CURRENT_ARTICLES);

export const BourbonCultureObservationSchema =
  ExternalReviewArticleIngestionSchema;

export type BourbonCultureCursor = z.infer<typeof BourbonCultureCursorSchema>;
export type BourbonCultureObservation = ExternalReviewArticleIngestion;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function articleUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    if (url.origin !== ORIGIN || !ARTICLE_PATH.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function discoverBourbonCultureArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();
  const heading = $("h2")
    .filter((_, element) =>
      /^Latest Whiskey Reviews$/iu.test(normalizeText($(element).text())),
    )
    .first();
  const list = heading.nextAll("ul.wp-block-latest-posts").first();

  list.find("a.wp-block-latest-posts__post-title[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_CURRENT_ARTICLES);
}

function score(value: string) {
  const match = /^Score:\s*(?<value>\d{1,2}(?:[.,]\d+)?)\s*\/\s*10$/iu.exec(
    normalizeText(value),
  );
  const nativeValue = match?.groups?.value
    ? Number(match.groups.value.replace(",", "."))
    : Number.NaN;
  if (!Number.isFinite(nativeValue) || nativeValue < 0 || nativeValue > 10) {
    return null;
  }
  const nativeScore = {
    value: nativeValue,
    scale: 10,
    display: `${match?.groups?.value}/10`,
  };
  return {
    nativeScore,
  };
}

function bottleName(title: string): string | null {
  const name = normalizeText(title.replace(/\s+Review$/iu, ""));
  return name === title ? null : name;
}

function sourceKey(canonicalUrl: string): string {
  const digest = createHash("sha256").update(canonicalUrl).digest("hex");
  return `bourbonculture:${digest}`;
}

export function parseBourbonCultureArticle(
  data: string,
  rawCanonicalUrl: URL,
): BourbonCultureObservation {
  const $ = cheerio(data);
  const canonicalUrl = articleUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
  );
  if (!canonicalUrl) throw new Error("Invalid Bourbon Culture article URL.");

  const article = $("article").first();
  const title = normalizeText(article.find("h1.entry-title").first().text());
  const name = bottleName(title);
  const reviewerName = normalizeText(
    $('meta[name="author"]').first().attr("content") ?? "",
  );
  const rawPublishedAt =
    article.find("time.entry-date").first().attr("datetime") ?? "";
  const publishedAt = parseDate(rawPublishedAt);
  const content = article.find(".entry-content").first();
  const elements = content.children("h2,p").toArray();
  const tastingIndex = elements.findIndex(
    (element) =>
      element.tagName === "h2" &&
      /^Tasting Notes$/iu.test(normalizeText($(element).text())),
  );
  const scoreIndex = elements.findIndex(
    (element, index) => index > tastingIndex && score($(element).text()),
  );
  const reviewScore =
    scoreIndex < 0 ? null : score($(elements[scoreIndex]).text());
  if (!title) throw new Error("Bourbon Culture article title is missing.");
  if (!name) throw new Error("Bourbon Culture Bottle name is missing.");
  if (!reviewerName) throw new Error("Bourbon Culture writer is missing.");
  if (!rawPublishedAt || !publishedAt) {
    throw new Error("Bourbon Culture article date is missing or invalid.");
  }
  if (tastingIndex < 0) {
    throw new Error("Bourbon Culture tasting notes are missing.");
  }
  if (!reviewScore) {
    throw new Error("Bourbon Culture score is missing or invalid.");
  }

  const reviewText = normalizeText(
    elements
      .slice(tastingIndex + 1, scoreIndex)
      .filter((element) => TASTING_NOTE.test(normalizeText($(element).text())))
      .map((element) => normalizeText($(element).text()))
      .join(" "),
  );
  const reviewSourceKey = sourceKey(canonicalUrl.href);
  const review = {
    sourceKey: reviewSourceKey,
    name,
    category: null,
    reviewerName,
    nativeScore: reviewScore.nativeScore,
  };
  const contentText = JSON.stringify({
    review,
    reviewText: reviewText || null,
  });

  return BourbonCultureObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      externalReviews: [review],
    },
    externalReviewTexts: reviewText ? { [reviewSourceKey]: reviewText } : {},
  });
}

export const bourbonCultureAdapter: ScraperAdapter<
  BourbonCultureCursor,
  BourbonCultureObservation
> = async ({ cursor, session }) => {
  const homepageResponse = await session.request({
    target: TARGET,
    url: new URL("/", ORIGIN),
  });
  const articleUrls = discoverBourbonCultureArticles(homepageResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) =>
      parseBourbonCultureArticle(response.body, response.url),
  });
};
