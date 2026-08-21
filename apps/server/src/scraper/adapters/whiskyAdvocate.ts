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

// Active runs can resume across deploys.
// Accept cursors written by the prior adapter.
export const WhiskyAdvocateCursorSchema = z
  .object({ processedIssues: z.array(z.string().min(1)) })
  .strict();

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

export async function parseReviews(
  data: string,
  url: string,
  callback: (review: WhiskyAdvocateReview) => Promise<void>,
) {
  const $ = cheerio(data);
  let parsed = 0;

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
    await callback({
      name,
      category: normalizeCategory(normalizeText(rawCategory)),
      rating: Number(rawRating),
      issue,
      url: absoluteUrl(url, reviewUrl),
    });
    parsed += 1;
  }

  return parsed;
}

export const whiskyAdvocateAdapter: ScraperAdapter<
  WhiskyAdvocateCursor,
  WhiskyAdvocateObservation
> = async ({ session }) => {
  const issueListUrl = new URL("/ratings-reviews", ORIGIN);
  const issueListResponse = await session.request({
    target: TARGET,
    url: issueListUrl,
  });
  const issue = parseIssueList(issueListResponse.body)[0];
  if (!issue) throw new Error("Whisky Advocate issue list is empty.");

  const reviewUrl = new URL("/ratings-reviews", ORIGIN);
  reviewUrl.searchParams.set("custom_rating_issue[0]", issue);
  reviewUrl.searchParams.set("order_by", "published_desc");
  const reviewResponse = await session.request({
    target: TARGET,
    url: reviewUrl,
  });
  const parsed = await parseReviews(
    reviewResponse.body,
    reviewResponse.url.href,
    async (review) => {
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
          publishedAt: null,
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
    },
  );
  if (parsed === 0) {
    throw new Error("Whisky Advocate issue contains no reviews.");
  }
};
