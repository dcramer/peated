import { logError } from "@peated/server/lib/log";
import {
  normalizeBottle,
  normalizeCategory,
} from "@peated/server/lib/normalize";
import {
  absoluteUrl,
  getUrl,
  type BottleReview,
} from "@peated/server/lib/scraper";
import { trpcClient } from "@peated/server/lib/trpc/server";
import { load as cheerio } from "cheerio";

export default async function scrapeWhiskeyAdvocate() {
  const issueList = await scrapeIssueList(
    "https://whiskyadvocate.com/ratings-reviews",
  );
  if (issueList.length === 0) {
    logError("No issues found for Whisky Advocate.");
    return;
  }

  console.log(`Found ${issueList.length} issues`);

  const processedIssues = process.env.ACCESS_TOKEN
    ? await trpcClient.externalSiteConfigGet.query({
        site: "whiskyadvocate",
        key: "processedIssues",
        default: [],
      })
    : [];

  const newIssues = issueList.filter((i) => !processedIssues.includes(i));
  if (newIssues.length === 0) {
    console.log("No unprocessed issues found");
    return;
  }

  console.log(`Found ${issueList.length} new issues`);

  for (const issueName of newIssues) {
    console.log(`Fetching reviews for issue [${issueName}]`);
    await scrapeReviews(
      `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
        issueName,
      )}&order_by=published_desc`,
      async (item) => {
        if (process.env.ACCESS_TOKEN) {
          console.log(`Submitting [${item.name}]`);

          try {
            await trpcClient.reviewCreate.mutate({
              site: "whiskyadvocate",
              ...item,
            });
          } catch (err) {
            console.error(err);
          }
        } else {
          console.log(`Dry Run [${item.name}]`);
        }
      },
    );

    processedIssues.push(issueName);
    console.log(`Done processing issue [${issueName}]`);

    if (process.env.ACCESS_TOKEN) {
      await trpcClient.externalSiteConfigSet.mutate({
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
    // <h5>Claxton’s Mannochmore 7 year old Oloroso Hogshead, 50% </h5>
    const rawName = $(".postsItemContent > h5", el).first().text().trim();
    if (!rawName) {
      console.warn("Unable to identify bottle name");
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
      console.warn(`Unable to identify review URL: ${rawName}`);
      continue;
    }

    const rawRating = $(".postsItemRanking > h2", el).first().text().trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      console.warn(
        `Unable to identify valid rating: ${rawName} (${rawRating})`,
      );
      continue;
    }
    const rating = Number(rawRating);

    const issue = $(".postsItemIssue", el).first().text().trim();
    if (!issue) {
      console.warn(`Unable to identify issue name: ${rawName}`);
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
      url: absoluteUrl(reviewUrl, url),
    });
  }
}
