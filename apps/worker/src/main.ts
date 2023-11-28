import * as Sentry from "@sentry/node-experimental";
import { ProfilingIntegration } from "@sentry/profiling-node";
import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import { AsyncTask, CronJob, ToadScheduler } from "toad-scheduler";
import pushJob from "../../server/src/jobs";
import packageData from "../package.json";
import generateBottleDetails from "./jobs/generateBottleDetails";
import generateEntityDetails from "./jobs/generateEntityDetails";
import notifyDiscordOnTasting from "./jobs/notifyDiscordOnTasting";
import scrapeAstorWines from "./jobs/scrapeAstorWines";
import scrapeHealthySpirits from "./jobs/scrapeHealthySpirits";
import scrapeTotalWine from "./jobs/scrapeTotalWine";
import scrapeWoodenCork from "./jobs/scrapeWoodenCork";

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

const scheduler = new ToadScheduler();

function job(schedule: string, name: string, cb: () => Promise<void>) {
  const task = new AsyncTask(name, async () => {
    const checkInId = Sentry.captureCheckIn(
      {
        monitorSlug: name,
        status: "in_progress",
      },
      {
        schedule: {
          type: "crontab",
          value: schedule,
        },
      },
    );

    Sentry.configureScope(function (scope) {
      scope.setContext("monitor", {
        slug: name,
      });
    });

    await Sentry.startSpan(
      {
        op: "job",
        name: name,
      },
      async () => {
        console.log(`Running job: ${name}`);

        try {
          await cb();

          Sentry.captureCheckIn({
            checkInId,
            monitorSlug: name,
            status: "ok",
          });
        } catch (e) {
          Sentry.captureException(e);
          Sentry.captureCheckIn({
            checkInId,
            monitorSlug: name,
            status: "error",
          });
        }
      },
    );
  });
  const job = new CronJob(
    {
      cronExpression: schedule,
    },
    task,
    {
      preventOverrun: true,
    },
  );
  scheduler.addCronJob(job);
}

async function main() {
  // dont run the scraper in dev
  if (process.env.NODE_ENV === "production") {
    job("*/60 * * * *", "scrape-wooden-cork", async () => {
      console.log("Scraping Wooden Cork");
      await pushJob("ScrapeWoodenCork");
    });

    job("*/60 * * * *", "scrape-total-wine", async () => {
      console.log("Scraping Total Wine");
      await pushJob("ScrapeTotalWine");
    });

    job("*/60 * * * *", "scrape-astor-wines", async () => {
      console.log("Scraping Astor Wines");
      await pushJob("ScrapeAstorWines");
    });

    job("*/60 * * * *", "scrape-healthy-spirits", async () => {
      console.log("Scraping Healthy Spirits");
      await pushJob("ScrapeHealthySpirits");
    });
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
faktory.register("GenerateBottleDetails", generateBottleDetails as JobFunction);
faktory.register("GenerateEntityDetails", generateEntityDetails as JobFunction);
faktory.register(
  "NotifyDiscordOnTasting",
  notifyDiscordOnTasting as JobFunction,
);
faktory.register("ScrapeAstorWines", scrapeAstorWines);
faktory.register("ScrapeHealthySpirits", scrapeHealthySpirits);
faktory.register("ScrapeTotalWine", scrapeTotalWine);
faktory.register("ScrapeWoodenCork", scrapeWoodenCork);

process.on("SIGINT", function () {
  scheduler.stop();
});

if (typeof require !== "undefined" && require.main === module) {
  main().catch((e) => console.error(e));
}
