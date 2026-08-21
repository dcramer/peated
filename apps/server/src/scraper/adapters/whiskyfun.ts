import {
  normalizeReviewRating,
  type ReviewArticleIngestion,
  ReviewArticleIngestionSchema,
  type ReviewArticleObservation,
} from "@peated/server/externalReviews/observation";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";

const ORIGIN = "https://www.whiskyfun.com";
const TARGET = "whiskyfun";
const MAX_FEED_ITEMS = 20;
const ARTICLE_PATH = /^\/\d{4}\/[^/]+\.html$/;
const NON_WHISKY_TITLE =
  /\b(?:armagnacs?|brand(?:y|ies)|calvados|cognacs?|mezcal|rums?|tequilas?)\b/iu;

const WhiskyfunFeedArticleSchema = z
  .object({
    canonicalUrl: z.url(),
    title: z.string().trim().min(1).max(1000),
    publishedAt: z.date(),
  })
  .strict();

export const WhiskyfunCursorSchema = z
  .object({
    processedArticleUrls: z.array(z.url()).max(MAX_FEED_ITEMS),
  })
  .strict();

export const WhiskyfunObservationSchema = ReviewArticleIngestionSchema;

export type WhiskyfunCursor = z.infer<typeof WhiskyfunCursorSchema>;
export type WhiskyfunObservation = ReviewArticleIngestion;
type WhiskyfunFeedArticle = z.infer<typeof WhiskyfunFeedArticleSchema>;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function articleUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    if (url.origin !== ORIGIN || !ARTICLE_PATH.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
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
    const publishedAt = new Date(rawPublishedAt);
    if (!rawPublishedAt || Number.isNaN(publishedAt.getTime())) {
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
  const match = /\bSGP:\s*\d{3}\s*-\s*(\d{1,3})\s+points?\b/iu.exec(value);
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
    normalizedRating: normalizeReviewRating(nativeScore),
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
): WhiskyfunObservation {
  const article = WhiskyfunFeedArticleSchema.parse(feedArticle);
  const canonicalUrl = articleUrl(article.canonicalUrl);
  if (!canonicalUrl) throw new Error("Invalid Whiskyfun article URL.");

  const $ = cheerio(data);
  const reviewerName =
    normalizeText($('meta[name="author"]').first().attr("content") ?? "") ||
    null;
  const reviews: ReviewArticleObservation["reviews"] = [];
  const reviewTexts: Record<string, string> = {};

  $("td.TextenormalNEW").each((_, element) => {
    const heading = $(element)
      .find(".textegrandfoncegras")
      .toArray()
      .map((candidate) => bottleName($(candidate).text()))
      .find((candidate) => candidate !== null);
    if (!heading) return;

    const reviewText = normalizeText($(element).text());
    const reviewScore = score(reviewText);
    if (!reviewScore) return;

    const sourceKey = reviewSourceKey(canonicalUrl.href, heading);
    reviews.push({
      sourceKey,
      name: heading,
      category: null,
      reviewerName,
      nativeScore: reviewScore.nativeScore,
      normalizedRating: reviewScore.normalizedRating,
    });
    reviewTexts[sourceKey] = reviewText;
  });

  if (reviews.length === 0) {
    throw new Error("Whiskyfun article contains no scored reviews.");
  }

  const contentText = Object.values(reviewTexts).join("\n");
  return WhiskyfunObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title: article.title,
      issue: null,
      publishedAt: article.publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews,
    },
    reviewTexts,
  });
}

export const whiskyfunAdapter: ScraperAdapter<
  WhiskyfunCursor,
  WhiskyfunObservation
> = async ({ cursor, session }) => {
  const feedResponse = await session.request({
    target: TARGET,
    url: new URL("/whatsnew.xml", ORIGIN),
  });
  const articles = discoverWhiskyfunArticles(feedResponse.body);
  const currentArticleUrls = new Set(
    articles.map(({ canonicalUrl }) => canonicalUrl),
  );
  const processedArticleUrls = new Set(
    (cursor?.processedArticleUrls ?? []).filter((url) =>
      currentArticleUrls.has(url),
    ),
  );

  for (const article of articles) {
    if (processedArticleUrls.has(article.canonicalUrl)) continue;
    const articleResponse = await session.request({
      target: TARGET,
      url: new URL(article.canonicalUrl),
    });
    const observation = parseWhiskyfunArticle(articleResponse.body, article);
    await session.emit({
      sourceKey: observation.article.canonicalUrl,
      itemCount: observation.article.reviews.length,
      value: observation,
    });
    processedArticleUrls.add(article.canonicalUrl);
    await session.checkpoint({
      processedArticleUrls: [...processedArticleUrls],
    });
  }
};
