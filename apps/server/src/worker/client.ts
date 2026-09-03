import { context, propagation } from "@opentelemetry/api";
import { scheduledJob, scheduler } from "@peated/server/lib/cron";
import * as Sentry from "@sentry/node";
import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { createHash } from "node:crypto";
import config from "../config";
import { syncExternalSites } from "../lib/externalSites";
import { logError, logInfo, logTelemetryError } from "../lib/log";
import { initializeScraperRuntime } from "../scraper";
import "./jobs";
import createNextRepeatingEvents from "./jobs/createNextRepeatingEvents";
import scheduleScrapers from "./jobs/scheduleScrapers";
import {
  buildJobContext,
  buildQueuedJobData,
  parseQueuedJobData,
} from "./payload";
import registry from "./registry";
import { type JobArgs, type JobName, type QueuedJobInput } from "./types";

export function generateUniqIdentifier(name: string, args?: JobArgs) {
  let hash = createHash("md5");
  if (args) {
    for (const item of Object.entries(args).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      hash = hash.update(JSON.stringify(item));
    }
  }
  return `${name}-${hash.digest("hex")}`;
}

async function runRegisteredJob(jobName: JobName, args?: JobArgs) {
  const activeContext = {};
  propagation.inject(context.active(), activeContext);

  const jobFn = registry.get(jobName);
  if (!jobFn) throw new Error(`Unknown job: ${jobName}`);
  return await jobFn(args, buildJobContext(activeContext));
}

async function pushUniqueJobToQueue(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  opts = {
    delay: 5000,
    ...(opts || {}),
    jobId: generateUniqIdentifier(jobName, args),
  };

  return await pushJobToQueue(jobName, args, opts);
}

async function pushJobToQueue(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  const queueName = registry.getQueueName(jobName);
  await Sentry.startSpan(
    {
      op: `publish ${queueName}`,
      name: `bullmq.${jobName.toLowerCase()}`,
    },
    async (span) => {
      span.setAttribute("messaging.system", "bullmq");
      span.setAttribute("messaging.operation.type", "send");
      span.setAttribute("messaging.operation.name", "publish");
      // TODO: THIS IS WRONG - it should set from the worker itself but idk that
      // we have that data
      span.setAttribute("messaging.destination.name", queueName);
      // TODO:
      // span.setAttribute("messaging.message.id", jobId);
      span.setAttribute("messaging.system", "bullmq");

      const activeContext = {};
      propagation.inject(context.active(), activeContext);

      const queue = await getQueue(queueName);
      try {
        await queue.add(jobName, buildQueuedJobData(args, activeContext), opts);
      } catch (e) {
        span.setStatus({
          code: 2, // ERROR
        });
        throw e;
      }
    },
  );
}

export type WorkerDispatch = {
  pushJob: typeof pushJobToQueue;
  pushUniqueJob: typeof pushUniqueJobToQueue;
  runJob: typeof runRegisteredJob;
};

const queueDispatch: WorkerDispatch = {
  pushJob: pushJobToQueue,
  pushUniqueJob: pushUniqueJobToQueue,
  runJob: runRegisteredJob,
};
let workerDispatch = queueDispatch;

export function configureWorkerDispatch(dispatch: WorkerDispatch) {
  workerDispatch = dispatch;
}

/** Restore the production Redis-backed dispatch after a test-owned override. */
export function useQueueWorkerDispatch() {
  workerDispatch = queueDispatch;
}

export async function runJob(jobName: JobName, args?: JobArgs) {
  return args === undefined
    ? await workerDispatch.runJob(jobName)
    : await workerDispatch.runJob(jobName, args);
}

export async function pushUniqueJob(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  if (opts !== undefined) {
    return await workerDispatch.pushUniqueJob(jobName, args, opts);
  }
  return args === undefined
    ? await workerDispatch.pushUniqueJob(jobName)
    : await workerDispatch.pushUniqueJob(jobName, args);
}

export async function pushJob(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  if (opts !== undefined) {
    return await workerDispatch.pushJob(jobName, args, opts);
  }
  return args === undefined
    ? await workerDispatch.pushJob(jobName)
    : await workerDispatch.pushJob(jobName, args);
}

let connection: IORedis | null = null;
const SCRAPER_JOB_LOCK_DURATION_MS = 60 * 60_000;

export async function getQueue(
  name = "default",
  connection: Awaited<ReturnType<typeof getConnection>> | null = null,
) {
  return new Queue(name, {
    connection: connection || (await getConnection()),
  });
}

export async function getConnection() {
  if (connection) return connection;

  connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  return connection;
}

export async function gracefulShutdown(signal?: string, worker?: Worker) {
  scheduler.stop();
  if (connection) connection.disconnect();
  connection = null;
}

export type WorkerRuntime = {
  queues: [Queue, Queue];
  workers: [Worker, Worker];
  close: () => Promise<void>;
};

/** Start the same Redis queues and registered job handlers used by the worker process. */
export async function startWorkerRuntime(): Promise<WorkerRuntime> {
  await syncExternalSites();
  await initializeScraperRuntime();

  const connection = await getConnection();
  const defaultQueue = await getQueue("default", connection);
  const scraperQueue = await getQueue("scrapers", connection);
  const processJob = async (job: { name: string; data: QueuedJobInput }) => {
    let jobFn;
    let queuedJob;
    try {
      jobFn = registry.get(job.name);
      queuedJob = parseQueuedJobData(job.data);
    } catch (error) {
      // Registry and envelope failures occur before the instrumented job boundary.
      logError(error);
      throw error;
    }
    const { args, context } = queuedJob;
    return await jobFn(args, context);
  };
  const defaultWorker = new Worker(defaultQueue.name, processJob, {
    connection,
    autorun: false,
  });
  const scraperWorker = new Worker(scraperQueue.name, processJob, {
    connection,
    autorun: false,
    concurrency: 4,
    // Scraper runs own a one-hour database lease and can wait on model or site requests.
    lockDuration: SCRAPER_JOB_LOCK_DURATION_MS,
  });

  for (const worker of [defaultWorker, scraperWorker]) {
    worker.on("failed", (job, error) => {
      // The instrumented job boundary already owns the Sentry issue.
      logTelemetryError(error, {
        extra: {
          job: job?.id,
        },
      });
    });

    worker.on("error", (error) => {
      logError(error);
    });
  }

  void defaultWorker.run();
  void scraperWorker.run();
  logInfo("Workers running", {
    extra: { queues: [defaultQueue.name, scraperQueue.name] },
  });

  return {
    queues: [defaultQueue, scraperQueue],
    workers: [defaultWorker, scraperWorker],
    async close() {
      await Promise.all([defaultWorker.close(), scraperWorker.close()]);
      await Promise.all([defaultQueue.close(), scraperQueue.close()]);
    },
  };
}

export async function runWorker() {
  // dont run the scraper in dev
  if (config.ENV === "production") {
    scheduledJob("*/5 * * * *", "schedule-scrapers", scheduleScrapers);
    scheduledJob("15 4 * * *", "create-next-repeating-events", async () => {
      await createNextRepeatingEvents();
    });
    scheduledJob(
      "17 * * * *",
      "reconcile-store-price-match-proposals",
      async () => {
        await runJob("ReconcileStorePriceMatchProposals");
      },
    );
    scheduledJob("0 * * * *", "cleanup-pending-uploads", async () => {
      await runJob("CleanupPendingUploads");
    });
  }

  const runtime = await startWorkerRuntime();

  async function termProcess(signal: string) {
    logInfo("Received {signal}, closing worker", {
      extra: {
        signal,
      },
    });

    await runtime.close();
    await gracefulShutdown();
    process.exit(0);
  }

  process.on("SIGINT", () => termProcess("SIGINT"));

  process.on("SIGTERM", () => termProcess("SIGTERM"));
}
