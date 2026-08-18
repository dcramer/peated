import {
  createExternalReview,
  ExternalReviewBottleStateError,
} from "@peated/server/lib/createExternalReview";
import {
  getExternalSiteConfig,
  setExternalSiteConfig,
} from "@peated/server/lib/externalSiteConfig";
import { logError, logInfo, logWarn } from "@peated/server/lib/log";
import {
  scrapeIssueList,
  scrapeReviews,
} from "@peated/server/scraper/adapters/whiskyAdvocate";
import { z } from "zod";

export { scrapeIssueList, scrapeReviews };

export default async function scrapeWhiskeyAdvocate({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  const issueList = await scrapeIssueList(
    "https://whiskyadvocate.com/ratings-reviews",
  );
  if (issueList.length === 0) {
    logError("[Whisky Advocate] No issues found");
    return 0;
  }

  logInfo("[Whisky Advocate] Found {issueCount} issues", {
    extra: {
      issueCount: issueList.length,
    },
  });

  const processedIssues = dryRun
    ? []
    : z.array(z.string()).parse(
        await getExternalSiteConfig({
          site: "whiskyadvocate",
          key: "processedIssues",
          defaultValue: [],
        }),
      );

  const newIssues = issueList.filter((i) => !processedIssues.includes(i));
  if (newIssues.length === 0) {
    logInfo("[Whisky Advocate] No unprocessed issues found", {});
    return 0;
  }

  logInfo("[Whisky Advocate] Found {issueCount} new issues", {
    extra: {
      issueCount: newIssues.length,
    },
  });

  let itemCount = 0;
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
        itemCount += 1;
        if (!dryRun) {
          logInfo("[Whisky Advocate] Submitting {name}", {
            extra: {
              name: item.name,
            },
          });

          try {
            await createExternalReview({
              site: "whiskyadvocate",
              ...item,
            });
          } catch (error) {
            if (!(error instanceof ExternalReviewBottleStateError)) throw error;

            logWarn(
              "[Whisky Advocate] Skipping review for unavailable bottle",
              {
                extra: {
                  bottleId: error.bottleId,
                  name: item.name,
                  reason: error.reason,
                },
              },
            );
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

    if (!dryRun) {
      await setExternalSiteConfig({
        site: "whiskyadvocate",
        key: "processedIssues",
        value: processedIssues,
      });
    }
  }
  return itemCount;
}
