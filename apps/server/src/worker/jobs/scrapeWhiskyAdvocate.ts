import {
  normalizeBottle,
  normalizeCategory,
} from "@peated/bottle-classifier/normalize";
import {
  logError,
  logInfo,
  logTelemetryError,
  logWarn,
} from "@peated/server/lib/log";
import { orpcClient } from "@peated/server/lib/orpc-client/server";
import { getUrl, type BottleReview } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";

export default async function scrapeWhiskeyAdvocate() {
  const issueList = await scrapeIssueList(
    "https://whiskyadvocate.com/ratings-reviews",
  );
  if (issueList.length === 0) {
    logError("[Whisky Advocate] No issues found");
    return;
  }

  logInfo("[Whisky Advocate] Found {issueCount} issues", {
    extra: {
      issueCount: issueList.length,
    },
  });

  const processedIssues = process.env.ACCESS_TOKEN
    ? await orpcClient.externalSites.config.get({
        site: "whiskyadvocate",
        key: "processedIssues",
        default: [],
      })
    : [];

  const newIssues = issueList.filter((i) => !processedIssues.includes(i));
  if (newIssues.length === 0) {
    logInfo("[Whisky Advocate] No unprocessed issues found", {});
    return;
  }

  logInfo("[Whisky Advocate] Found {issueCount} new issues", {
    extra: {
      issueCount: newIssues.length,
    },
  });

  for (const issueName of newIssues) {
    logInfo("[Whisky Advocate] Fetching reviews for issue {issueName}", {
      extra: {
        issueName,
      },
    });
    await scrapeReviews(
      `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
        issueName,
      )}&order_by=published_desc`,
      async (item) => {
        if (process.env.ACCESS_TOKEN) {
          logInfo("[Whisky Advocate] Submitting {name}", {
            extra: {
              name: item.name,
            },
          });

          try {
            await orpcClient.reviews.create({
              site: "whiskyadvocate",
              ...item,
            });
          } catch (err) {
            logTelemetryError(err, {
              extra: {
                name: item.name,
              },
            });
          }
        } else {
          logInfo("[Whisky Advocate] Dry Run {name}", {
            extra: {
              name: item.name,
            },
          });
        }
      },
    );

    processedIssues.push(issueName);
    logInfo("[Whisky Advocate] Done processing issue {issueName}", {
      extra: {
        issueName,
      },
    });

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
      logWarn("[Whisky Advocate] Unable to identify bottle name", {});
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
      logWarn("[Whisky Advocate] Unable to identify review URL for {rawName}", {
        extra: {
          rawName,
        },
      });
      continue;
    }

    const rawRating = $(".postsItemRanking > h2", el).first().text().trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      logWarn("[Whisky Advocate] Unable to identify valid rating", {
        extra: {
          rawName,
          rawRating,
        },
      });
      continue;
    }
    const rating = Number(rawRating);

    const issue = $(".postsItemIssue", el).first().text().trim();
    if (!issue) {
      logWarn("[Whisky Advocate] Unable to identify issue name for {rawName}", {
        extra: {
          rawName,
        },
      });
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
