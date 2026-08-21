import {
  normalizeReviewRating,
  type ReviewArticleIngestion,
  ReviewArticleIngestionSchema,
  type ReviewArticleObservation,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { ScraperAdapter } from "../types";
import {
  currentReviewCursorSchema,
  processCurrentReviews,
} from "./currentReviews";

// This adapter owns Dramface-specific discovery and parsing. The shared
// scraper runtime owns every remote request and the shared sink owns storage.
const ORIGIN = "https://www.dramface.com";
const TARGET = "dramface";
const MAX_INDEX_ARTICLES = 20;
const ARTICLE_PATH = /^\/all-reviews\/\d{4}\/[^/]+$/;
const REVIEW_HEADING =
  /^Review(?:\s+\d+\s*\/\s*\d+)?(?:\s*-\s*(?<reviewer>.+))?$/iu;
const TASTING_HEADING = /^(?:Nose|Palate|Finish|The Dregs)\s*:?$/iu;
const MONTHS = new Map(
  [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].map((month, index) => [month, index]),
);

export const DramfaceCursorSchema =
  currentReviewCursorSchema(MAX_INDEX_ARTICLES);

export const DramfaceObservationSchema = ReviewArticleIngestionSchema;

export type DramfaceCursor = z.infer<typeof DramfaceCursorSchema>;
export type DramfaceObservation = ReviewArticleIngestion;

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

export function discoverDramfaceArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();

  $("main a[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_INDEX_ARTICLES);
}

function publishedAt(value: string, canonicalUrl: URL): Date {
  const match =
    /^(?<day>\d{1,2})\s+(?<month>[A-Z][a-z]{2})(?:,?\s+(?<year>\d{4}))?$/u.exec(
      normalizeText(value),
    );
  const month = match?.groups?.month
    ? MONTHS.get(match.groups.month.toLocaleLowerCase("en"))
    : undefined;
  const day = match?.groups?.day ? Number(match.groups.day) : Number.NaN;
  const pathYear = /^\/all-reviews\/(?<year>\d{4})\//u.exec(
    canonicalUrl.pathname,
  )?.groups?.year;
  const year = Number(match?.groups?.year ?? pathYear);
  if (
    month === undefined ||
    !Number.isInteger(day) ||
    !Number.isInteger(year)
  ) {
    throw new Error("Dramface article date is invalid.");
  }

  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Dramface article date is invalid.");
  }
  return date;
}

function score(value: string) {
  const match = /^Score:\s*(?<value>\d{1,2}(?:[.,]\d+)?)\s*\/\s*10\b/iu.exec(
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
    normalizedRating: normalizeReviewRating(nativeScore),
  };
}

function bottleName(value: string): string | null {
  return value.split("\n").map(normalizeText).find(Boolean) ?? null;
}

function reviewSourceKey(
  canonicalUrl: string,
  name: string,
  reviewerName: string | null,
): string {
  const digest = createHash("sha256")
    .update(
      [canonicalUrl, name, reviewerName ?? ""]
        .map((value) => normalizeText(value).toLocaleLowerCase("en"))
        .join("\n"),
    )
    .digest("hex");
  return `dramface:${digest}`;
}

export function parseDramfaceArticle(
  data: string,
  rawCanonicalUrl: URL,
): DramfaceObservation {
  const $ = cheerio(data);
  const canonicalUrl = articleUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
  );
  if (!canonicalUrl) throw new Error("Invalid Dramface article URL.");

  const article = $("article").first();
  const title = normalizeText(article.find(".blog-item-title").first().text());
  const articleReviewerName =
    normalizeText(article.find(".blog-author-name").first().text()) || null;
  const dateElement = article.find("time.dt-published").first();
  const dateText = dateElement.attr("datetime") ?? dateElement.text();
  if (!title) throw new Error("Dramface article title is missing.");
  if (!dateText) throw new Error("Dramface article date is missing.");

  const elements = article.find("h1,h2,h3,h4,p").toArray();
  const reviewStarts = elements.flatMap((element, index) =>
    element.tagName === "h3" &&
    REVIEW_HEADING.test(normalizeText($(element).text()))
      ? [index]
      : [],
  );
  const reviews: ReviewArticleObservation["reviews"] = [];
  const reviewTexts: Record<string, string> = {};

  for (const [reviewIndex, start] of reviewStarts.entries()) {
    const end = reviewStarts[reviewIndex + 1] ?? elements.length;
    const section = elements.slice(start, end);
    const heading = normalizeText($(section[0]).text());
    const reviewerMatch = REVIEW_HEADING.exec(heading);
    const reviewerName =
      normalizeText(reviewerMatch?.groups?.reviewer ?? "") ||
      articleReviewerName;
    const bottleElement = section.find(
      (element) =>
        element.tagName === "p" && $(element).hasClass("sqsrte-large"),
    );
    const bottleContent = bottleElement ? $(bottleElement).clone() : null;
    bottleContent?.find("br").replaceWith("\n");
    const name = bottleContent ? bottleName(bottleContent.text()) : null;
    const reviewScore = section
      .map((element) => score($(element).text()))
      .find((value) => value !== null);
    if (!name || !reviewScore) continue;

    const sourceKey = reviewSourceKey(canonicalUrl.href, name, reviewerName);
    reviews.push({
      sourceKey,
      name,
      category: null,
      reviewerName,
      nativeScore: reviewScore.nativeScore,
      normalizedRating: reviewScore.normalizedRating,
    });

    const tastingStart = section.findIndex((element) =>
      TASTING_HEADING.test(normalizeText($(element).text())),
    );
    const finalScore = section.findLastIndex((element) =>
      score($(element).text()),
    );
    const reviewText = normalizeText(
      tastingStart < 0
        ? ""
        : section
            .slice(
              tastingStart + 1,
              finalScore > tastingStart ? finalScore : section.length,
            )
            .filter((element) => element.tagName === "p")
            .map((element) => $(element).text())
            .join(" "),
    );
    if (reviewText) reviewTexts[sourceKey] = reviewText;
  }

  if (reviews.length === 0) {
    throw new Error("Dramface article contains no scored review sections.");
  }

  const contentText = JSON.stringify(
    reviews.map((review) => ({
      ...review,
      reviewText: reviewTexts[review.sourceKey] ?? null,
    })),
  );
  return DramfaceObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt: publishedAt(dateText, canonicalUrl),
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews,
    },
    reviewTexts,
  });
}

export const dramfaceAdapter: ScraperAdapter<
  DramfaceCursor,
  DramfaceObservation
> = async ({ cursor, session }) => {
  const indexResponse = await session.request({
    target: TARGET,
    url: new URL("/all-reviews", ORIGIN),
  });
  const articleUrls = discoverDramfaceArticles(indexResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) => parseDramfaceArticle(response.body, response.url),
  });
};
