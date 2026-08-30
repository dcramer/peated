import { normalizeCategory } from "@peated/bottle-classifier/normalize";
import {
  type ExternalReviewArticleIngestion,
  ExternalReviewArticleIngestionSchema,
} from "@peated/server/externalReviews/observation";
import { logWarn } from "@peated/server/lib/log";
import { absoluteUrl } from "@peated/server/lib/urls";
import { CategoryEnum } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";
import { parseDate } from "./dates";

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

const DatedWhiskyAdvocateCursorSchema = z
  .object({
    checksReviewDates: z.literal(true),
    completedIssues: z.array(z.string().min(1)).max(500),
    issue: z.string().min(1).nullable(),
    completedReviewUrls: z.array(z.url()).max(500),
  })
  .strict();

// Active runs can resume across deploys.
// Accept cursors written by the prior adapter.
export const WhiskyAdvocateCursorSchema = z.union([
  DatedWhiskyAdvocateCursorSchema,
  LegacyWhiskyAdvocateCursorSchema,
  CurrentWhiskyAdvocateCursorSchema,
]);

export type WhiskyAdvocateCursor = z.infer<typeof WhiskyAdvocateCursorSchema>;

const WhiskyAdvocateExternalReviewSchema = z
  .object({
    name: z.string().min(1),
    category: CategoryEnum.nullable(),
    rating: z.number().min(1).max(100),
    url: z.string().url(),
    issue: z.string().min(1),
  })
  .strict();

type WhiskyAdvocateReview = z.infer<typeof WhiskyAdvocateExternalReviewSchema>;

export const WhiskyAdvocateObservationSchema =
  ExternalReviewArticleIngestionSchema;
export type WhiskyAdvocateObservation = ExternalReviewArticleIngestion;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

export function parseReviewPublishedAt(data: string): Date {
  const $ = cheerio(data);
  const metadata = $("script")
    .toArray()
    .map((element) => $(element).text())
    .find((value) => /"datePublished"\s*:/iu.test(value));
  const rawValue = metadata?.match(/"datePublished"\s*:\s*"(?<value>[^"]+)"/iu)
    ?.groups?.value;
  if (!rawValue) throw new Error("Whisky Advocate review date is missing.");

  const templateValue = rawValue.match(
    /^\{\{\s*(?<value>.+?)\s*\|\s*iso8601\s*\}\}$/iu,
  )?.groups?.value;
  const publishedAt = parseDate(templateValue ?? rawValue);
  if (!publishedAt) {
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
  const externalReviews: WhiskyAdvocateReview[] = [];

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
    externalReviews.push({
      name,
      category: normalizeCategory(normalizeText(rawCategory)),
      rating: Number(rawRating),
      issue,
      url: absoluteUrl(url, reviewUrl),
    });
  }

  return externalReviews;
}

export const whiskyAdvocateAdapter: ScraperAdapter<
  WhiskyAdvocateCursor,
  WhiskyAdvocateObservation
> = async ({ cursor, session }) => {
  const issueListResponse = await session.request({
    target: TARGET,
    url: new URL("/ratings-reviews", ORIGIN),
  });
  const issueList = parseIssueList(issueListResponse.body);
  if (issueList.length === 0) {
    throw new Error("Whisky Advocate issue list is empty.");
  }
  // Old saved progress skipped dates, so start again from the newest issue.
  const completedIssues = new Set(
    cursor && "checksReviewDates" in cursor ? cursor.completedIssues : [],
  );
  const activeIssue = cursor && "issue" in cursor ? cursor.issue : null;
  const issue =
    activeIssue ?? issueList.find((value) => !completedIssues.has(value));
  if (!issue) return;
  const completedReviewUrls = new Set(
    cursor && "completedReviewUrls" in cursor ? cursor.completedReviewUrls : [],
  );

  const reviewUrl = new URL("/ratings-reviews", ORIGIN);
  reviewUrl.searchParams.set("custom_rating_issue[0]", issue);
  reviewUrl.searchParams.set("order_by", "published_desc");
  const reviewResponse = await session.request({
    target: TARGET,
    url: reviewUrl,
  });
  const externalReviews = parseReviews(
    reviewResponse.body,
    reviewResponse.url.href,
  );
  if (externalReviews.length === 0) {
    throw new Error("Whisky Advocate issue contains no external reviews.");
  }

  for (const review of externalReviews) {
    if (completedReviewUrls.has(review.url)) continue;
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
        externalReviews: [
          {
            sourceKey: review.url,
            name: review.name,
            category: review.category,
            reviewerName: null,
            nativeScore,
          },
        ],
      },
    });
    await session.emit({ sourceKey: review.url, value });
    completedReviewUrls.add(review.url);
    await session.checkpoint({
      checksReviewDates: true,
      completedIssues: [...completedIssues],
      issue,
      completedReviewUrls: [...completedReviewUrls],
    });
  }

  completedIssues.add(issue);
  await session.checkpoint({
    checksReviewDates: true,
    completedIssues: [...completedIssues],
    issue: null,
    completedReviewUrls: [],
  });
};
