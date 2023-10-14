import * as Sentry from "@sentry/node-experimental";
import { ProfilingIntegration } from "@sentry/profiling-node";
import faktory from "faktory-worker";
import { AsyncTask, CronJob, ToadScheduler } from "toad-scheduler";

const scheduler = new ToadScheduler();

import generateBottleDetails from "./jobs/generateBottleDetails";
import generateEntityDetails from "./jobs/generateEntityDetails";
import { main as astorwines } from "./price-scraper/astorwines";
import { main as healthyspirits } from "./price-scraper/healthyspirits";
import { main as totalwine } from "./price-scraper/totalwine";
import { main as woodencork } from "./price-scraper/woodencork";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [new ProfilingIntegration()],
});

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
      await woodencork();
    });

    job("*/60 * * * *", "scrape-total-wine", async () => {
      console.log("Scraping Total Wine");
      await totalwine();
    });

    job("*/60 * * * *", "scrape-astor-wines", async () => {
      console.log("Scraping Astor Wines");
      await astorwines();
    });

    job("*/60 * * * *", "scrape-healthy-spirits", async () => {
      console.log("Scraping Healthy Spirits");
      await healthyspirits();
    });
  }

  const worker = await faktory.work().catch((error) => {
    console.error(`worker failed to start: ${error}`);
    process.exit(1);
  });

  worker.on("fail", ({ job, error }) => {
    Sentry.captureException(error, {
      extra: {
        job: job.jid,
      },
    });
  });

  console.log("Scheduler Running...");
}

faktory.register("GenerateBottleDetails", generateBottleDetails);
faktory.register("GenerateEntityDetails", generateEntityDetails);

process.on("SIGINT", function () {
  scheduler.stop();
});

if (typeof require !== "undefined" && require.main === module) {
  main().catch((e) => console.error(e));
}
