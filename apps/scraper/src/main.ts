import { gracefulShutdown, scheduleJob } from "node-schedule";
import { main as totalwines } from "./price-scraper/totalwines";
import { main as woodencork } from "./price-scraper/woodencork";

import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

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

function jobWrapper(name: string, cb: () => Promise<void>) {
  return async () => {
    const transaction = Sentry.startTransaction({
      op: "job",
      name: name,
    });

    console.log(`Running job: ${name}`);

    try {
      await cb();
    } catch (e) {
      Sentry.captureException(e);
    } finally {
      transaction.finish();
    }
  };
}

scheduleJob(
  "0 0 * * *",
  jobWrapper("woodencork", async () => {
    console.log("Scraping Wooden Cork");
    await woodencork();
  }),
);

scheduleJob(
  "0 1 * * *",
  jobWrapper("totalwines", async () => {
    console.log("Scraping Total Wines");
    await totalwines();
  }),
);

process.on("SIGINT", function () {
  gracefulShutdown().then(() => process.exit(0));
});
