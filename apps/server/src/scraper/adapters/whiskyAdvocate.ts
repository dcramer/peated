import { normalizeCategory } from "@peated/bottle-classifier/normalize";
import {
  normalizeReviewRating,
  type ReviewArticleIngestion,
  ReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { logWarn } from "@peated/server/lib/log";
import { absoluteUrl } from "@peated/server/lib/urls";
import { CategoryEnum } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";

const ORIGIN = "https://whiskyadvocate.com";
const TARGET = "whiskyadvocate";

const LegacyWhiskyAdvocateCursorSchema = z
  .object({ processedIssues: z.array(z.string().min(1)) })
  .strict();

const CurrentWhiskyAdvocateCursorSchema = z
  .object({
    issue: z.string().min(1),
    processedReviewUrls: z.array(z.url()).max(500),
  })
  .strict();

// Active runs can resume across deploys.
// Accept cursors written by the prior adapter.
export const WhiskyAdvocateCursorSchema = z.union([
  LegacyWhiskyAdvocateCursorSchema,
  CurrentWhiskyAdvocateCursorSchema,
]);

export type WhiskyAdvocateCursor = z.infer<typeof WhiskyAdvocateCursorSchema>;

const WhiskyAdvocateReviewSchema = z
  .object({
    name: z.string().min(1),
    category: CategoryEnum.nullable(),
    rating: z.number().min(1).max(100),
    url: z.string().url(),
    issue: z.string().min(1),
  })
  .strict();

type WhiskyAdvocateReview = z.infer<typeof WhiskyAdvocateReviewSchema>;

export const WhiskyAdvocateObservationSchema = ReviewArticleIngestionSchema;
export type WhiskyAdvocateObservation = ReviewArticleIngestion;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

export function parseReviewPublishedAt(data: string): Date | null {
  const $ = cheerio(data);
  const metadata = $("script")
    .toArray()
    .map((element) => $(element).text())
    .find((value) => /"datePublished"\s*:/iu.test(value));
  const rawValue = metadata?.match(/"datePublished"\s*:\s*"(?<value>[^"]+)"/iu)
    ?.groups?.value;
  if (!rawValue) return null;

  const templateValue = rawValue.match(
    /^\{\{\s*(?<value>.+?)\s*\|\s*iso8601\s*\}\}$/iu,
  )?.groups?.value;
  const publishedAt = new Date(
    templateValue ? `${templateValue} UTC` : rawValue,
  );
  if (Number.isNaN(publishedAt.getTime())) {
    throw new Error("Whisky Advocate review date is invalid.");
  }
  return publishedAt;
}

export function parseIssueList(data: string) {
  const $ = cheerio(data);
  const results: string[] = [];
  $("select")
    .filter((_, element) => {
      return element.attribs.name === "filters[default][custom_rating_issue][]";
    })
    .find("option")
    .each((_, element) => {
      const value = $(element).text().trim();
      if (element.attribs.value === "" || !value) return;
      results.push(value);
    });
  return results;
}

export function parseReviews(data: string, url: string) {
  const $ = cheerio(data);
  const reviews: WhiskyAdvocateReview[] = [];

  for (const element of $("#directoryResults .postsItem")) {
    const name = normalizeText(
      $(".postsItemContent > h5", element).first().text(),
    );
    if (!name) {
      logWarn("[Whisky Advocate] Unable to identify bottle name", {});
      continue;
    }

    const reviewUrl = $("a.postsItemLink", element).first().attr("href");
    if (!reviewUrl) {
      logWarn("[Whisky Advocate] Unable to identify review URL for {name}", {
        extra: { name },
      });
      continue;
    }

    const rawRating = $(".postsItemRanking > h2", element)
      .first()
      .text()
      .trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      logWarn("[Whisky Advocate] Unable to identify valid rating", {
        extra: { name, rawRating },
      });
      continue;
    }

    const issue = $(".postsItemIssue", element).first().text().trim();
    if (!issue) {
      logWarn("[Whisky Advocate] Unable to identify issue name for {name}", {
        extra: { name },
      });
      continue;
    }

    const rawCategory = $(".postsItemContent h6", element)
      .first()
      .contents()
      .first()
      .text();
    reviews.push({
      name,
      category: normalizeCategory(normalizeText(rawCategory)),
      rating: Number(rawRating),
      issue,
      url: absoluteUrl(url, reviewUrl),
    });
  }

  return reviews;
}

export const whiskyAdvocateAdapter: ScraperAdapter<
  WhiskyAdvocateCursor,
  WhiskyAdvocateObservation
> = async ({ cursor, session }) => {
  const activeCursor =
    cursor && "processedReviewUrls" in cursor ? cursor : null;
  let issue = activeCursor?.issue;
  if (!issue) {
    const issueListResponse = await session.request({
      target: TARGET,
      url: new URL("/ratings-reviews", ORIGIN),
    });
    issue = parseIssueList(issueListResponse.body)[0];
  }
  if (!issue) throw new Error("Whisky Advocate issue list is empty.");
  const processedReviewUrls = new Set(activeCursor?.processedReviewUrls ?? []);

  const reviewUrl = new URL("/ratings-reviews", ORIGIN);
  reviewUrl.searchParams.set("custom_rating_issue[0]", issue);
  reviewUrl.searchParams.set("order_by", "published_desc");
  const reviewResponse = await session.request({
    target: TARGET,
    url: reviewUrl,
  });
  const reviews = parseReviews(reviewResponse.body, reviewResponse.url.href);
  if (reviews.length === 0) {
    throw new Error("Whisky Advocate issue contains no reviews.");
  }

  for (const review of reviews) {
    if (processedReviewUrls.has(review.url)) continue;
    const articleResponse = await session.request({
      target: TARGET,
      url: new URL(review.url),
    });
    const publishedAt = parseReviewPublishedAt(articleResponse.body);
    const nativeScore = {
      value: review.rating,
      scale: 100,
      display: `${review.rating}/100`,
    };
    const value = WhiskyAdvocateObservationSchema.parse({
      article: {
        canonicalUrl: review.url,
        title: review.name,
        issue: review.issue,
        publishedAt,
        contentHash: createHash("sha256")
          .update(
            JSON.stringify({
              name: review.name,
              category: review.category,
              rating: review.rating,
              url: review.url,
              issue: review.issue,
            }),
          )
          .digest("hex"),
        reviews: [
          {
            sourceKey: review.url,
            name: review.name,
            category: review.category,
            reviewerName: null,
            nativeScore,
            normalizedRating: normalizeReviewRating(nativeScore),
          },
        ],
      },
      reviewTexts: {},
    });
    await session.emit({ sourceKey: review.url, value });
    processedReviewUrls.add(review.url);
    await session.checkpoint({
      issue,
      processedReviewUrls: [...processedReviewUrls],
    });
  }
};
