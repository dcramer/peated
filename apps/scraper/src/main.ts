import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import { AsyncTask, CronJob, ToadScheduler } from "toad-scheduler";

const scheduler = new ToadScheduler();

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
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new ProfilingIntegration(),
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
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

    const transaction = Sentry.startTransaction({
      op: "job",
      name: name,
    });

    Sentry.configureScope(function (scope) {
      scope.setContext("monitor", {
        slug: name,
      });
    });

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
    } finally {
      transaction.finish();
    }
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

process.on("SIGINT", function () {
  scheduler.stop();
});

console.log("Scheduler Running...");
