import {
  normalizeBottleName,
  normalizeCategory,
} from "@peated/server/lib/normalize";
import { getUrl } from "@peated/worker/scraper";
import { type BottleReview } from "@peated/worker/types";
import { load as cheerio } from "cheerio";
import { trpcClient } from "../lib/api";
import { absoluteUrl } from "./utils";

export default async function main() {
  const issueList = await scrapeIssueList(
    "https://whiskyadvocate.com/ratings-reviews",
  );
  console.log(`Found ${issueList.length} issues`);

  const reviewList: BottleReview[] = [];
  const uniqueReviews = new Set();

  for (const issueName of issueList) {
    await scrapeReviews(
      `https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=${encodeURIComponent(
        issueName,
      )}&order_by=published_desc`,
      async (bottle) => {
        if (uniqueReviews.has(bottle.name)) return;
        reviewList.push(bottle);
        uniqueReviews.add(bottle.name);
      },
    );
  }

  if (process.env.ACCESS_TOKEN) {
    console.log("Pushing new price data to API");
    for (const item of reviewList) {
      await trpcClient.reviewCreate.mutate({
        site: "whiskyadvocate",
        ...item,
      });
    }
  } else {
    console.log(`Dry Run Complete - ${reviewList.length} products found`);
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

  $("#directoryResults .postsItem").each((_, el) => {
    // <h5>Claxton’s Mannochmore 7 year old Oloroso Hogshead, 50% </h5>
    const rawName = $(".postsItemContent > h5", el).first().text().trim();
    if (!rawName) {
      console.warn("Unable to identify bottle name");
      return;
    }
    const name = normalizeBottleName(rawName.replace(/,\s[\d.]+%$/, ""));

    const reviewUrl = $("a.postsItemLink", el).first().attr("href");
    if (!reviewUrl)
      throw new Error(`Unable to identify review URL: ${rawName}`);

    const rawRating = $(".postsItemRanking > h2", el).first().text().trim();
    if (!rawRating || Number(rawRating) < 1 || Number(rawRating) > 100) {
      console.warn(
        `Unable to identify valid rating: ${rawName} (${rawRating})`,
      );
      return;
    }
    const rating = Number(rawRating);

    const issue = $(".postsItemIssue", el).first().text().trim();
    if (!issue) {
      console.warn(`Unable to identify issue name: ${rawName}`);
      return;
    }

    // <h6>Single Malt Scotch<br />$116</h6>
    const rawCategory = $(".postsItemContent h6", el).first().text().trim();
    // TODO: remove price
    const category = normalizeCategory(rawCategory.replace(/<br\s\\>.+$/, ""));

    console.log(`${name} - ${rating}`);

    cb({
      name,
      category,
      rating,
      issue,
      url: absoluteUrl(reviewUrl, url),
    });
  });
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
