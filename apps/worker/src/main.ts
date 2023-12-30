import { registerJob } from "@peated/server/jobs";
import * as Sentry from "@sentry/node-experimental";
import { ProfilingIntegration } from "@sentry/profiling-node";
import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import packageData from "../package.json";
import generateBottleDetails from "./jobs/generateBottleDetails";
import generateEntityDetails from "./jobs/generateEntityDetails";
import notifyDiscordOnTasting from "./jobs/notifyDiscordOnTasting";
import scheduleScrapers from "./jobs/scheduleScrapers";
import scrapeAstorWines from "./jobs/scrapeAstorWines";
import scrapeHealthySpirits from "./jobs/scrapeHealthySpirits";
import scrapeTotalWine from "./jobs/scrapeTotalWine";
import scrapeWhiskeyAdvocate from "./jobs/scrapeWhiskyAdvocate";
import scrapeWoodenCork from "./jobs/scrapeWoodenCork";
import { scheduledJob, scheduler } from "./lib/cron";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [new ProfilingIntegration()],
  spotlight: process.env.NODE_ENV === "development",
});
Sentry.setTag("service", packageData.name);

async function main() {
  // dont run the scraper in dev
  if (process.env.NODE_ENV === "production") {
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

  console.log("Scheduler Running...");
}

// faktory does not have correct types
registerJob("GenerateBottleDetails", generateBottleDetails as JobFunction);
registerJob("GenerateEntityDetails", generateEntityDetails as JobFunction);
registerJob("NotifyDiscordOnTasting", notifyDiscordOnTasting as JobFunction);
registerJob("ScrapeAstorWines", scrapeAstorWines);
registerJob("ScrapeHealthySpirits", scrapeHealthySpirits);
registerJob("ScrapeTotalWine", scrapeTotalWine);
registerJob("ScrapeWoodenCork", scrapeWoodenCork);
registerJob("ScrapeWhiskyAdvocate", scrapeWhiskeyAdvocate);

process.on("SIGINT", function () {
  scheduler.stop();
});

if (typeof require !== "undefined" && require.main === module) {
  main().catch((e) => console.error(e));
}
