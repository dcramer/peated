import { context, propagation } from "@opentelemetry/api";
import { scheduledJob, scheduler } from "@peated/server/lib/cron";
import * as Sentry from "@sentry/node";
import faktory, { type Client } from "faktory-worker";
import config from "../config";
import { logError } from "../lib/log";
import "./jobs";
import { runJob } from "./jobs";
import scheduleScrapers from "./jobs/scheduleScrapers";
import { type JobName } from "./jobs/types";

let client: Client | null = null;

// process.on("SIGTERM", () => shutdownClient());
// process.on("SIGINT", () => shutdownClient());
// process.on("SIGUSR1", () => shutdownClient());
// process.on("SIGUSR2", () => shutdownClient());
// process.on("uncaughtException", () => shutdownClient());
// process.on("beforeExit", () => shutdownClient());

export async function getClient() {
  if (!client) {
    client = await faktory.connect();
  }
  return client;
}

export async function hasActiveClient() {
  return !!client;
}

export async function shutdownClient() {
  if (!client) return;
  await client.close();
  client = null;
}

export { runJob };

export async function pushJob(jobName: JobName, args?: any) {
  const client = await getClient();
  await Sentry.startSpan(
    {
      op: "publish",
      name: `faktory.${jobName.toLowerCase()}`,
    },
    async (span) => {
      span.setAttribute("messaging.operation", "publish");
      span.setAttribute("messaging.system", "faktory");

      // pull out traceparent to forward to faktory job
      const activeContext = {};
      propagation.inject(context.active(), activeContext);
      try {
        await client.job(jobName, args, { traceContext: activeContext }).push();
      } catch (e) {
        span.setStatus({
          code: 2, // ERROR
        });
        throw e;
      }
    },
  );
}

export async function runWorker() {
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

  process.on("SIGINT", function () {
    scheduler.stop();
  });

  console.log("Worker Running...");
}
