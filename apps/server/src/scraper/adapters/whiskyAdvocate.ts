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
import { ScraperHttpStatusError } from "../http";
import type { ScraperAdapter } from "../types";
import { parseDate } from "./dates";
import { readReviewBody } from "./reviewBody";

const ORIGIN = "https://whiskyadvocate.com";
const TARGET = "whiskyadvocate";

export const WhiskyAdvocateCursorSchema = z
  .object({
    checksReviewDates: z.literal(true),
    completedIssues: z.array(z.string().min(1)).max(500),
    issue: z.string().min(1).nullable(),
    completedReviewUrls: z.array(z.url()).max(500),
    // Reviews already saved from the newest issue, which every run checks again.
    newestIssue: z
      .object({
        issue: z.string().min(1),
        reviewUrls: z.array(z.url()).max(500),
      })
      .nullable()
      .default(null),
  })
  .strict();

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

export function parseReviewBody(data: string): string {
  const $ = cheerio(data);
  const body = readReviewBody($(".postDetailsContent").first());
  if (!body) throw new Error("Whisky Advocate review body is missing.");
  return body;
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
  const completedIssues = new Set(cursor?.completedIssues ?? []);
  let issue = cursor?.issue ?? null;
  const completedReviewUrls = new Set(issue ? cursor?.completedReviewUrls : []);
  // Whisky Advocate can add reviews to its current issue after a run finished
  // it. Every run checks the newest issue again and reads only unsaved reviews.
  const newestIssue = issueList[0]!;
  completedIssues.delete(newestIssue);
  const newestIssueReviewUrls = new Set(
    cursor?.newestIssue?.issue === newestIssue
      ? cursor.newestIssue.reviewUrls
      : [],
  );

  const saveProgress = async () => {
    await session.checkpoint({
      checksReviewDates: true,
      completedIssues: [...completedIssues],
      issue,
      completedReviewUrls: [...completedReviewUrls],
      newestIssue: {
        issue: newestIssue,
        reviewUrls: [...newestIssueReviewUrls],
      },
    });
  };
  const finishReview = async (url: string) => {
    completedReviewUrls.add(url);
    if (issue === newestIssue) newestIssueReviewUrls.add(url);
    await saveProgress();
  };
  const finishIssue = async (finished: string) => {
    completedIssues.add(finished);
    issue = null;
    completedReviewUrls.clear();
    await saveProgress();
  };

  while (true) {
    issue ??= issueList.find((value) => !completedIssues.has(value)) ?? null;
    if (!issue) return;

    const reviewUrl = new URL("/ratings-reviews", ORIGIN);
    reviewUrl.searchParams.set("custom_rating_issue[0]", issue);
    reviewUrl.searchParams.set("order_by", "published_desc");
    let reviewResponse;
    try {
      reviewResponse = await session.request({
        target: TARGET,
        url: reviewUrl,
      });
    } catch (error) {
      // The issue list can name an issue whose review page was removed. Record
      // it as done so the run reaches the remaining issues instead of failing
      // at the same place every day.
      if (
        !(error instanceof ScraperHttpStatusError) ||
        ![404, 410].includes(error.status)
      ) {
        throw error;
      }
      logWarn("[Whisky Advocate] Issue page is missing for {issue}", {
        extra: { issue, url: reviewUrl.href, status: error.status },
      });
      await finishIssue(issue);
      continue;
    }
    const externalReviews = parseReviews(
      reviewResponse.body,
      reviewResponse.url.href,
    );
    if (externalReviews.length === 0) {
      throw new Error("Whisky Advocate issue contains no external reviews.");
    }

    for (const review of externalReviews) {
      if (
        completedReviewUrls.has(review.url) ||
        (issue === newestIssue && newestIssueReviewUrls.has(review.url))
      ) {
        continue;
      }
      let articleResponse;
      try {
        articleResponse = await session.request({
          target: TARGET,
          url: new URL(review.url),
        });
      } catch (error) {
        // An issue can list a review whose page was removed. Skip it so the
        // rest of the issue is still collected instead of failing every run.
        if (
          !(error instanceof ScraperHttpStatusError) ||
          ![404, 410].includes(error.status)
        ) {
          throw error;
        }
        logWarn("[Whisky Advocate] Review page is missing for {name}", {
          extra: { name: review.name, url: review.url, status: error.status },
        });
        await finishReview(review.url);
        continue;
      }
      const publishedAt = parseReviewPublishedAt(articleResponse.body);
      const body = parseReviewBody(articleResponse.body);
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
                body,
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
        externalReviewTexts: {},
        externalReviewBodies: { [review.url]: body },
      });
      await session.emit({ sourceKey: review.url, value });
      await finishReview(review.url);
    }

    await finishIssue(issue);
  }
};
