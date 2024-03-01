// make sure to import this _before_ all other code
import "./sentry";

import { registerJob } from "@peated/server/jobs";
import * as Sentry from "@sentry/node-experimental";
import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import createMissingBottles from "./jobs/createMissingBottles";
import generateBottleDetails from "./jobs/generateBottleDetails";
import generateEntityDetails from "./jobs/generateEntityDetails";
import notifyDiscordOnTasting from "./jobs/notifyDiscordOnTasting";
import scheduleScrapers from "./jobs/scheduleScrapers";
import scrapeAstorWines from "./jobs/scrapeAstorWines";
import scrapeHealthySpirits from "./jobs/scrapeHealthySpirits";
import scrapeSMWS from "./jobs/scrapeSMWS";
import scrapeSMWSA from "./jobs/scrapeSMWSA";
import scrapeTotalWine from "./jobs/scrapeTotalWine";
import scrapeWhiskeyAdvocate from "./jobs/scrapeWhiskyAdvocate";
import scrapeWoodenCork from "./jobs/scrapeWoodenCork";
import { scheduledJob, scheduler } from "./lib/cron";

async function main() {
  // dont run the scraper in dev
  if (process.env.NODE_ENV !== "development") {
    scheduledJob("*/5 * * * *", "schedule-scrapers", scheduleScrapers);
  }

  const worker = await faktory.work().catch((error) => {
    console.error(`worker failed to start: ${error}`);
    Sentry.captureException(error);
    process.exit(1);
  });

  worker.on("fail", ({ job, error }) => {
    console.error(error);
    Sentry.captureException(error, {
      extra: {
        job: job.jid,
      },
    });
  });

  console.log("Worker Running...");
}

// faktory does not have correct types
registerJob("GenerateBottleDetails", generateBottleDetails as JobFunction);
registerJob("GenerateEntityDetails", generateEntityDetails as JobFunction);
registerJob("NotifyDiscordOnTasting", notifyDiscordOnTasting as JobFunction);
registerJob("ScrapeAstorWines", scrapeAstorWines);
registerJob("ScrapeHealthySpirits", scrapeHealthySpirits);
registerJob("ScrapeSMWS", scrapeSMWS);
registerJob("ScrapeSMWSA", scrapeSMWSA);
registerJob("ScrapeTotalWine", scrapeTotalWine);
registerJob("ScrapeWoodenCork", scrapeWoodenCork);
registerJob("ScrapeWhiskyAdvocate", scrapeWhiskeyAdvocate);
registerJob("CreateMissingBottles", createMissingBottles);

process.on("SIGINT", function () {
  scheduler.stop();
});

if (typeof require !== "undefined" && require.main === module) {
  main().catch((e) => {
    Sentry.captureException(e);
    console.error("Worker crashed", e);
  });
}
