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

// This adapter owns The Whiskey Reviewer parsing. The shared scraper runtime
// owns every remote request and the shared review sink owns storage.
const ORIGIN = "https://whiskeyreviewer.com";
const TARGET = "whiskeyreviewer";
const MAX_CURRENT_ARTICLES = 5;
const ARTICLE_PATH = /^\/(?<year>\d{4})\/(?<month>\d{2})\/[a-z0-9][a-z0-9-]*$/u;
const TASTING_TEXT = /\b(?:nose|palate|finish)\b/iu;
interface ReviewGradeValues {
  readonly [grade: string]: number | undefined;
}

const GRADE_VALUES: ReviewGradeValues = {
  "A+": 100,
  A: 95,
  "A-": 90,
  "B+": 87,
  B: 83,
  "B-": 80,
  "C+": 77,
  C: 73,
  "C-": 70,
  "D+": 67,
  D: 63,
  "D-": 60,
  F: 0,
};

export const WhiskeyReviewerCursorSchema =
  currentReviewCursorSchema(MAX_CURRENT_ARTICLES);

export const WhiskeyReviewerObservationSchema =
  ExternalReviewArticleIngestionSchema;

export type WhiskeyReviewerCursor = z.infer<typeof WhiskeyReviewerCursorSchema>;
export type WhiskeyReviewerObservation = ExternalReviewArticleIngestion;

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

export function discoverWhiskeyReviewerArticles(data: string): URL[] {
  const $ = cheerio(data);
  const articles = new Map<string, URL>();
  const reviewWidget = $(".widget.posts-list")
    .filter((_, element) =>
      /^Recent Reviews$/iu.test(
        normalizeText($(element).find(".widget-title").first().text()),
      ),
    )
    .first();

  reviewWidget.find("a.post-title[href]").each((_, element) => {
    const url = articleUrl($(element).attr("href") ?? "");
    if (url) articles.set(url.href, url);
  });

  return [...articles.values()].slice(0, MAX_CURRENT_ARTICLES);
}

function publishedAt(url: URL): Date | null {
  const pathMatch = ARTICLE_PATH.exec(url.pathname);
  const slug = url.pathname.split("/").at(-1) ?? "";
  const dateMatch = /(?<month>\d{2})(?<day>\d{2})(?<year>\d{2})$/u.exec(slug);
  if (!pathMatch?.groups || !dateMatch?.groups) return null;

  const year = Number(pathMatch.groups.year);
  const pathMonth = Number(pathMatch.groups.month);
  const month = Number(dateMatch.groups.month);
  const shortYear = Number(dateMatch.groups.year);
  if (year % 100 !== shortYear || pathMonth !== month) return null;

  return parseDate(`${year}-${dateMatch.groups.month}-${dateMatch.groups.day}`);
}

function reviewGrade(value: string) {
  const match =
    /^Rating:\s*(?<grade>A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F)$/iu.exec(
      normalizeText(value),
    );
  const grade = match?.groups?.grade?.toLocaleUpperCase("en");
  if (!grade) return null;
  const gradeValue = GRADE_VALUES[grade];
  if (gradeValue === undefined) return null;

  const nativeScore = {
    value: gradeValue,
    scale: 100,
    display: grade,
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
  return `whiskeyreviewer:${digest}`;
}

export function parseWhiskeyReviewerArticle(
  data: string,
  rawCanonicalUrl: URL,
): WhiskeyReviewerObservation {
  const $ = cheerio(data);
  const canonicalUrl = articleUrl(
    $('link[rel="canonical"]').first().attr("href") ?? rawCanonicalUrl.href,
  );
  if (!canonicalUrl) throw new Error("Invalid Whiskey Reviewer article URL.");

  const article = $("#the-post").first();
  const title = normalizeText(article.find("h1.entry-title").first().text());
  const name = bottleName(title);
  const paragraphs = article
    .find(".entry-content")
    .first()
    .children("p")
    .toArray();
  const reviewerMatch = paragraphs
    .map((element) =>
      /^By\s+(?<name>.+)$/iu.exec(normalizeText($(element).text())),
    )
    .find((match) => match?.groups?.name);
  const reviewerName = normalizeText(reviewerMatch?.groups?.name ?? "");
  const ratingIndex = paragraphs.findIndex((element) =>
    reviewGrade($(element).text()),
  );
  const grade =
    ratingIndex < 0 ? null : reviewGrade($(paragraphs[ratingIndex]).text());
  if (!title) throw new Error("Whiskey Reviewer article title is missing.");
  if (!name) throw new Error("Whiskey Reviewer Bottle name is missing.");
  if (!reviewerName) throw new Error("Whiskey Reviewer writer is missing.");
  if (!grade) throw new Error("Whiskey Reviewer grade is missing or invalid.");

  const priceIndex = paragraphs.findIndex(
    (element, index) =>
      index > ratingIndex &&
      /^The Price\b/iu.test(normalizeText($(element).text())),
  );
  const reviewText = normalizeText(
    paragraphs
      .slice(ratingIndex + 1, priceIndex < 0 ? paragraphs.length : priceIndex)
      .map((element) => {
        const paragraph = $(element).clone();
        paragraph.find("br").replaceWith(" ");
        return normalizeText(paragraph.text());
      })
      .filter((text) => TASTING_TEXT.test(text))
      .join(" "),
  );
  const reviewSourceKey = sourceKey(canonicalUrl.href);
  const review = {
    sourceKey: reviewSourceKey,
    name,
    category: null,
    reviewerName,
    nativeScore: grade.nativeScore,
  };
  const contentText = JSON.stringify({
    review,
    reviewText: reviewText || null,
  });

  return WhiskeyReviewerObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt: publishedAt(canonicalUrl),
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      externalReviews: [review],
    },
    externalReviewTexts: reviewText ? { [reviewSourceKey]: reviewText } : {},
  });
}

export const whiskeyReviewerAdapter: ScraperAdapter<
  WhiskeyReviewerCursor,
  WhiskeyReviewerObservation
> = async ({ cursor, session }) => {
  const homepageResponse = await session.request({
    target: TARGET,
    url: new URL("/", ORIGIN),
  });
  const articleUrls = discoverWhiskeyReviewerArticles(homepageResponse.body);
  await processCurrentReviews({
    target: TARGET,
    articles: articleUrls,
    articleUrl: (url) => url,
    cursor,
    session,
    parse: (response) =>
      parseWhiskeyReviewerArticle(response.body, response.url),
  });
};
