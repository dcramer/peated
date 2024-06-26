// make sure to import this _before_ all other code
import "./sentry";

import config from "@peated/server/config";
import { registerJob } from "@peated/server/jobs/client";
import createMissingBottles from "@peated/server/jobs/createMissingBottles";
import generateBottleDetails from "@peated/server/jobs/generateBottleDetails";
import generateEntityDetails from "@peated/server/jobs/generateEntityDetails";
import notifyDiscordOnTasting from "@peated/server/jobs/notifyDiscordOnTasting";
import scheduleScrapers from "@peated/server/jobs/scheduleScrapers";
import scrapeAstorWines from "@peated/server/jobs/scrapeAstorWines";
import scrapeHealthySpirits from "@peated/server/jobs/scrapeHealthySpirits";
import scrapeSMWS from "@peated/server/jobs/scrapeSMWS";
import scrapeSMWSA from "@peated/server/jobs/scrapeSMWSA";
import scrapeTotalWine from "@peated/server/jobs/scrapeTotalWine";
import scrapeWhiskeyAdvocate from "@peated/server/jobs/scrapeWhiskyAdvocate";
import scrapeWoodenCork from "@peated/server/jobs/scrapeWoodenCork";
import { scheduledJob, scheduler } from "@peated/server/lib/cron";
import { logError } from "@peated/server/lib/log";
import * as Sentry from "@sentry/node";
import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import geocodeCountryLocation from "./jobs/geocodeCountryLocation";
import geocodeEntityLocation from "./jobs/geocodeEntityLocation";

async function main() {
  // dont run the scraper in dev
  if (config.ENV === "production") {
    scheduledJob("*/5 * * * *", "schedule-scrapers", scheduleScrapers);
  }

  const worker = await faktory.work().catch((error) => {
    console.error(`worker failed to start`, error);
    Sentry.captureException(error);
    process.exit(1);
  });

  worker.on("fail", ({ job, error }) => {
    logError(error, {
      extra: {
        job: job.jid,
      },
    });
  });

  worker.on("error", ({ error }) => {
    logError(error);
  });

  console.log("Worker Running...");
}

// faktory does not have correct types
registerJob("GenerateBottleDetails", generateBottleDetails as JobFunction);
registerJob("GenerateEntityDetails", generateEntityDetails as JobFunction);
registerJob("GeocodeCountryLocation", geocodeCountryLocation as JobFunction);
registerJob("GeocodeEntityLocation", geocodeEntityLocation as JobFunction);
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
