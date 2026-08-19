import {
  normalizeBottle,
  normalizeCategory,
} from "@peated/bottle-classifier/normalize";
import { logWarn } from "@peated/server/lib/log";
import { absoluteUrl } from "@peated/server/lib/urls";
import { CategoryEnum } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import type { ScraperAdapter } from "../types";

export const WhiskyAdvocateCursorSchema = z
  .object({ processedIssues: z.array(z.string().min(1)) })
  .strict();

export const WhiskyAdvocateObservationSchema = z
  .object({
    name: z.string().min(1),
    category: CategoryEnum.nullable(),
    rating: z.number().min(1).max(100),
    url: z.string().url(),
    issue: z.string().min(1),
  })
  .strict();

export type WhiskyAdvocateObservation = z.infer<
  typeof WhiskyAdvocateObservationSchema
>;

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
  callback: (review: WhiskyAdvocateObservation) => Promise<void>,
) {
  const $ = cheerio(data);

  for (const element of $("#directoryResults .postsItem")) {
    const rawName = $(".postsItemContent > h5", element).first().text().trim();
    if (!rawName) {
      logWarn("[Whisky Advocate] Unable to identify bottle name", {});
      continue;
    }
    const { name } = normalizeBottle({
      name: rawName
        .replaceAll(/\n/gi, "")
        .trim()
        .replace(/,\s[\d.]+%,?$/, ""),
    });

    const reviewUrl = $("a.postsItemLink", element).first().attr("href");
    if (!reviewUrl) {
      logWarn("[Whisky Advocate] Unable to identify review URL for {rawName}", {
        extra: { rawName },
      });
      continue;
    }

    const rawRating = $(".postsItemRanking > h2", element)
      .first()
      .text()
      .trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      logWarn("[Whisky Advocate] Unable to identify valid rating", {
        extra: { rawName, rawRating },
      });
      continue;
    }

    const issue = $(".postsItemIssue", element).first().text().trim();
    if (!issue) {
      logWarn("[Whisky Advocate] Unable to identify issue name for {rawName}", {
        extra: { rawName },
      });
      continue;
    }

    const rawCategory = $(".postsItemContent h6", element)
      .first()
      .text()
      .trim();
    await callback({
      name,
      category: normalizeCategory(rawCategory.replace(/<br\s\\>.+$/, "")),
      rating: Number(rawRating),
      issue,
      url: absoluteUrl(url, reviewUrl),
    });
  }
}

export const whiskyAdvocateAdapter: ScraperAdapter<
  z.infer<typeof WhiskyAdvocateCursorSchema>,
  WhiskyAdvocateObservation
> = async ({ cursor, session }) => {
  const processedIssues = [...(cursor?.processedIssues ?? [])];
  const issueListUrl = new URL("https://whiskyadvocate.com/ratings-reviews");
  const issueListResponse = await session.request({
    target: "whiskyadvocate",
    url: issueListUrl,
  });
  const issueList = parseIssueList(issueListResponse.body);

  for (const issue of issueList) {
    if (processedIssues.includes(issue)) continue;

    const reviewUrl = new URL(
      `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
        issue,
      )}&order_by=published_desc`,
    );
    const reviewResponse = await session.request({
      target: "whiskyadvocate",
      url: reviewUrl,
    });
    await parseReviews(reviewResponse.body, reviewUrl.href, async (review) => {
      await session.emit({ sourceKey: review.url, value: review });
    });
    processedIssues.push(issue);
    await session.checkpoint({ processedIssues });
  }
};
