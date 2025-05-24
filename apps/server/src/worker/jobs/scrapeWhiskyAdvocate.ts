import { logError } from "@peated/server/lib/log";
import {
  normalizeBottle,
  normalizeCategory,
} from "@peated/server/lib/normalize";
import { orpcClient } from "@peated/server/lib/orpc-client/server";
import { getUrl, type BottleReview } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { logger } from "@sentry/node";
import { load as cheerio } from "cheerio";

export default async function scrapeWhiskeyAdvocate() {
  const issueList = await scrapeIssueList(
    "https://whiskyadvocate.com/ratings-reviews",
  );
  if (issueList.length === 0) {
    logError("[Whisky Advocate] No issues found");
    return;
  }

  logger.info(
    logger.fmt`[Whisky Advocate] Found ${String(issueList.length)} issues`,
  );

  const processedIssues = process.env.ACCESS_TOKEN
    ? await orpcClient.externalSites.config.get({
        site: "whiskyadvocate",
        key: "processedIssues",
        default: [],
      })
    : [];

  const newIssues = issueList.filter((i) => !processedIssues.includes(i));
  if (newIssues.length === 0) {
    logger.info(logger.fmt`[Whisky Advocate] No unprocessed issues found`);
    return;
  }

  logger.info(
    logger.fmt`[Whisky Advocate] Found ${String(newIssues.length)} new issues`,
  );

  for (const issueName of newIssues) {
    logger.info(
      logger.fmt`[Whisky Advocate] Fetching reviews for issue [${issueName}]`,
    );
    await scrapeReviews(
      `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
        issueName,
      )}&order_by=published_desc`,
      async (item) => {
        if (process.env.ACCESS_TOKEN) {
          logger.info(logger.fmt`[Whisky Advocate] Submitting [${item.name}]`);

          try {
            await orpcClient.reviews.create({
              site: "whiskyadvocate",
              ...item,
            });
          } catch (err) {
            console.error(err);
          }
        } else {
          logger.info(logger.fmt`[Whisky Advocate] Dry Run [${item.name}]`);
        }
      },
    );

    processedIssues.push(issueName);
    logger.info(
      logger.fmt`[Whisky Advocate] Done processing issue [${issueName}]`,
    );

    if (process.env.ACCESS_TOKEN) {
      await orpcClient.externalSites.config.set({
        site: "whiskyadvocate",
        key: "processedIssues",
        value: processedIssues,
      });
    }
  }
}

export async function scrapeIssueList(
  url = "https://whiskyadvocate.com/ratings-reviews",
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  const results: string[] = [];
  $("select")
    .filter((_, el) => {
      return el.attribs.name === "filters[default][custom_rating_issue][]";
    })
    .find("option")
    .each((_, el) => {
      const value = $(el).text().trim();
      if (el.attribs.value === "" || !value) return;
      results.push(value);
    });
  return results;
}

export async function scrapeReviews(
  url: string,
  cb: (review: BottleReview) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  for (const el of $("#directoryResults .postsItem")) {
    // <h5>Claxton's Mannochmore 7 year old Oloroso Hogshead, 50% </h5>
    const rawName = $(".postsItemContent > h5", el).first().text().trim();
    if (!rawName) {
      logger.warn(logger.fmt`[Whisky Advocate] Unable to identify bottle name`);
      continue;
    }
    const { name } = normalizeBottle({
      name: rawName
        .replaceAll(/\n/gi, "")
        .trim()
        .replace(/,\s[\d.]+%,?$/, ""),
    });

    const reviewUrl = $("a.postsItemLink", el).first().attr("href");
    if (!reviewUrl) {
      logger.warn(
        logger.fmt`[Whisky Advocate] Unable to identify review URL: ${rawName}`,
      );
      continue;
    }

    const rawRating = $(".postsItemRanking > h2", el).first().text().trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      logger.warn(
        logger.fmt`[Whisky Advocate] Unable to identify valid rating: ${rawName} (${rawRating})`,
      );
      continue;
    }
    const rating = Number(rawRating);

    const issue = $(".postsItemIssue", el).first().text().trim();
    if (!issue) {
      logger.warn(
        logger.fmt`[Whisky Advocate] Unable to identify issue name: ${rawName}`,
      );
      continue;
    }

    // <h6>Single Malt Scotch<br />$116</h6>
    const rawCategory = $(".postsItemContent h6", el).first().text().trim();
    const category = normalizeCategory(rawCategory.replace(/<br\s\\>.+$/, ""));

    await cb({
      name,
      category,
      rating,
      issue,
      url: absoluteUrl(url, reviewUrl),
    });
  }
}
