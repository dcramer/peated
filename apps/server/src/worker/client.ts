import { context, propagation } from "@opentelemetry/api";
import { scheduledJob, scheduler } from "@peated/server/lib/cron";
import * as Sentry from "@sentry/node";
import type { JobsOptions } from "bullmq";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import config from "../config";
import { logError } from "../lib/log";
import "./jobs";
import scheduleScrapers from "./jobs/scheduleScrapers";
import { defaultQueue } from "./queues";
import registry from "./registry";
import { type JobName } from "./types";

import { createHash } from "crypto";

export function generateUniqIdentifier(
  name: string,
  args?: Record<string, any>,
) {
  let hash = createHash("md5");
  if (args) {
    for (const item of Object.entries(args).sort()) {
      hash = hash.update(JSON.stringify(item));
    }
  }
  return `${name}-${hash.digest("hex")}`;
}

export async function runJob<T>(jobName: JobName, args?: Record<string, any>) {
  const jobFn = registry.get(jobName);
  if (!jobFn) throw new Error(`Unknown job: ${jobName}`);
  return await jobFn(args);
}

export async function pushUniqueJob(
  jobName: JobName,
  args?: any,
  opts?: JobsOptions,
) {
  opts = {
    ...(opts || {}),
    jobId: generateUniqIdentifier(jobName, args),
  };

  return await pushJob(jobName, args, opts);
}

export async function pushJob(
  jobName: JobName,
  args?: Record<string, any>,
  opts?: JobsOptions,
) {
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
        await defaultQueue.add(
          jobName,
          {
            args,
            context: { traceContext: activeContext },
          },
          opts,
        );
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

  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    defaultQueue.name,
    async (job) => {
      const jobFn = registry.get(job.name);
      const { args, context } = job.data;
      jobFn(args, context);
    },
    { connection, autorun: false },
  );

  worker.on("failed", (job, error) => {
    logError(error, {
      extra: {
        job: job?.id,
      },
    });
  });

  worker.on("error", (error) => {
    logError(error);
  });

  process.on("SIGINT", function () {
    scheduler.stop();
  });

  worker.run();
  console.log("Worker Running...");
}
