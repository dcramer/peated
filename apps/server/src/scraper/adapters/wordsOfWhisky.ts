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

// This adapter owns Words of Whisky parsing. The shared scraper runtime owns
// every remote request and the shared review sink owns storage.
const ORIGIN = "https://wordsofwhisky.com";
const TARGET = "wordsofwhisky";
const MAX_HOMEPAGE_ARTICLES = 20;
const ARTICLE_PATH = /^\/[a-z0-9][a-z0-9-]*$/u;
const TASTING_PARAGRAPH = /^(?:Nose|Palate|Taste|Finish)\s*:/iu;

export const WordsOfWhiskyCursorSchema = currentReviewCursorSchema(
  MAX_HOMEPAGE_ARTICLES,
);

export const WordsOfWhiskyObservationSchema = ReviewArticleIngestionSchema;

export type WordsOfWhiskyCursor = z.infer<typeof WordsOfWhiskyCursorSchema>;
export type WordsOfWhiskyObservation = ReviewArticleIngestion;

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

export function discoverWordsOfWhiskyArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();

  $("article.category-tastingnotes a[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_HOMEPAGE_ARTICLES);
}

function publishedAt(value: string): Date {
  const date = new Date(value);
  if (!value.trim() || Number.isNaN(date.getTime())) {
    throw new Error("Words of Whisky article date is invalid.");
  }
  return date;
}

function score(value: string) {
  const match = /^(?<value>\d{1,2}(?:[.,]\d+)?)$/u.exec(normalizeText(value));
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
  return `wordsofwhisky:${digest}`;
}

export function parseWordsOfWhiskyArticle(
  data: string,
  rawCanonicalUrl: URL,
): WordsOfWhiskyObservation {
  const $ = cheerio(data);
  const canonicalUrl = articleUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
  );
  if (!canonicalUrl) throw new Error("Invalid Words of Whisky article URL.");

  const article = $(".post-wrap").first();
  const title = normalizeText(article.find(".entry-title").first().text());
  const reviewerName =
    normalizeText(
      article.find(".side-author__wrap .side-meta .title").first().text(),
    ) || null;
  const dateText =
    article.find("time.entry-date").first().attr("datetime") ?? "";
  if (!title) throw new Error("Words of Whisky article title is missing.");
  if (!dateText) throw new Error("Words of Whisky article date is missing.");

  const elements = article.find(".entry-content").first().children().toArray();
  const reviewStarts = elements.flatMap((element, index) =>
    element.tagName === "h2" ? [index] : [],
  );
  const reviews: ReviewArticleObservation["reviews"] = [];
  const reviewTexts: Record<string, string> = {};

  for (const [reviewIndex, start] of reviewStarts.entries()) {
    const end = reviewStarts[reviewIndex + 1] ?? elements.length;
    const section = elements.slice(start, end);
    const name = normalizeText($(section[0]).text());
    const reviewBlock = section.find((element) =>
      $(element).hasClass("lets-review-block__wrap"),
    );
    const reviewScore = reviewBlock
      ? score(
          $(reviewBlock).find(".lets-review-block__final-score").first().text(),
        )
      : null;
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

    const reviewText = normalizeText(
      section
        .filter((element) => element.tagName === "p")
        .map((element) => normalizeText($(element).text()))
        .filter((text) => TASTING_PARAGRAPH.test(text))
        .join(" "),
    );
    if (reviewText) reviewTexts[sourceKey] = reviewText;
  }

  if (reviews.length === 0) {
    throw new Error(
      "Words of Whisky article contains no scored Bottle sections.",
    );
  }

  const contentText = JSON.stringify(
    reviews.map((review) => ({
      ...review,
      reviewText: reviewTexts[review.sourceKey] ?? null,
    })),
  );
  return WordsOfWhiskyObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt: publishedAt(dateText),
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews,
    },
    reviewTexts,
  });
}

export const wordsOfWhiskyAdapter: ScraperAdapter<
  WordsOfWhiskyCursor,
  WordsOfWhiskyObservation
> = async ({ cursor, session }) => {
  const homepageResponse = await session.request({
    target: TARGET,
    url: new URL("/", ORIGIN),
  });
  const articleUrls = discoverWordsOfWhiskyArticles(homepageResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) => parseWordsOfWhiskyArticle(response.body, response.url),
  });
};
