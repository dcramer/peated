import { context, propagation } from "@opentelemetry/api";
import { scheduledJob, scheduler } from "@peated/server/lib/cron";
import * as Sentry from "@sentry/node";
import { Worker, type JobsOptions, type Queue } from "bullmq";
import { createHash } from "node:crypto";
import config from "../config";
import { syncExternalSites } from "../lib/externalSites";
import { logError, logInfo, logTelemetryError } from "../lib/log";
import { isModelServiceUnavailable } from "../lib/openaiClient";
import { initializeScraperRuntime } from "../scraper";
import { SCRAPER_JOB_LOCK_MS } from "../scraper/runTimeout";
import { pushJob, runJob, type WorkerDispatch } from "./dispatch";
import "./jobs";
import createNextRepeatingEvents from "./jobs/createNextRepeatingEvents";
import scheduleScrapers from "./jobs/scheduleScrapers";
import {
  buildJobContext,
  buildQueuedJobData,
  parseQueuedJobData,
} from "./payload";
import { getQueue, removeOldFailedJobs } from "./queue";
import { disconnectConnection, getConnection } from "./redis";
import registry from "./registry";
import { type JobArgs, type JobName, type QueuedJobInput } from "./types";

export {
  configureWorkerDispatch,
  pushJob,
  runJob,
  useQueueWorkerDispatch,
} from "./dispatch";
export type { WorkerDispatch } from "./dispatch";
export { getQueue } from "./queue";
export { getConnection } from "./redis";

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

/**
 * Worker queue rule: unique jobs deduplicate on a key built from the job name
 * and arguments, not on a fixed job ID. A push while the job is waiting merges
 * into it. A push while it is running is kept, and BullMQ queues it once when
 * the run finishes (`keepLastIfActive`), so a change made mid-run is never
 * lost and two runs with the same key never overlap.
 */
export function buildUniqueJobOptions(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
): JobsOptions {
  const { jobId: _jobId, ...callerOpts } = opts ?? {};
  return {
    delay: 5000,
    removeOnComplete: true,
    removeOnFail: false,
    ...callerOpts,
    deduplication: {
      id: generateUniqIdentifier(jobName, args),
      keepLastIfActive: true,
    },
  };
}

/**
 * Worker queue rule: the job's registration decides whether it is unique, so
 * every caller of the same job gets the same deduplication.
 */
async function pushJobToQueue(
  jobName: JobName,
  args?: JobArgs,
  opts?: JobsOptions,
) {
  if (!registry.isUnique(jobName)) {
    return await addJobToQueue(jobName, args, opts);
  }
  return await addJobToQueue(
    jobName,
    args,
    buildUniqueJobOptions(jobName, args, opts),
  );
}

async function addJobToQueue(
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

export const queueWorkerDispatch: WorkerDispatch = {
  pushJob: pushJobToQueue,
  runJob: runRegisteredJob,
};
const MODEL_SERVICE_PAUSE_MS = 15 * 60 * 1000;

export async function gracefulShutdown(signal?: string, worker?: Worker) {
  scheduler.stop();
  disconnectConnection();
}

export type WorkerRuntime = {
  queues: Queue[];
  workers: Worker[];
  close: () => Promise<void>;
};

/** Start the same Redis queues and registered job handlers used by the worker process. */
export async function startWorkerRuntime(): Promise<WorkerRuntime> {
  await syncExternalSites();
  await initializeScraperRuntime();

  const connection = await getConnection();
  const defaultQueue = await getQueue("default", connection);
  const scraperQueue = await getQueue("scrapers", connection);
  const modelsQueue = await getQueue("models", connection);
  type QueueJob = { name: string; data: QueuedJobInput };
  const processJob = async (job: QueueJob) => {
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
  const processModelJob = async (job: QueueJob) => {
    try {
      return await processJob(job);
    } catch (error) {
      if (!(error instanceof Error) || !isModelServiceUnavailable(error)) {
        throw error;
      }
      // Worker queue rule: an unavailable AI service pauses every model job and
      // puts this one back without using an attempt.
      await modelsWorker.rateLimit(MODEL_SERVICE_PAUSE_MS);
      throw Worker.RateLimitError();
    }
  };
  const defaultWorker = new Worker(defaultQueue.name, processJob, {
    connection,
    autorun: false,
  });
  const scraperWorker = new Worker(scraperQueue.name, processJob, {
    connection,
    autorun: false,
    concurrency: 4,
    lockDuration: SCRAPER_JOB_LOCK_MS,
  });
  // The separate queue keeps slow model calls from starving the default queue.
  const modelsWorker = new Worker(modelsQueue.name, processModelJob, {
    connection,
    autorun: false,
    concurrency: 4,
    // BullMQ honors a manual pause only when a limiter is set; this one is
    // never reached.
    limiter: { max: 1000, duration: 1000 },
  });
  const queues = [defaultQueue, scraperQueue, modelsQueue];
  const workers = [defaultWorker, scraperWorker, modelsWorker];

  for (const worker of workers) {
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

  for (const worker of workers) void worker.run();
  logInfo("Workers running", {
    extra: { queues: queues.map((queue) => queue.name) },
  });

  return {
    queues,
    workers,
    async close() {
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(queues.map((queue) => queue.close()));
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
    scheduledJob("3 * * * *", "cleanup-wrong-photo-match-photos", async () => {
      await runJob("CleanupWrongPhotoMatchPhotos");
    });
    scheduledJob("7 * * * *", "process-account-deletions", async () => {
      await runJob("ProcessAccountDeletions");
    });
    scheduledJob("27 * * * *", "update-external-reviews", async () => {
      await pushJob(
        "UpdateExternalReviews",
        {},
        { removeOnComplete: true, removeOnFail: false },
      );
    });
  }

  const runtime = await startWorkerRuntime();

  if (config.ENV === "production") {
    scheduledJob("41 * * * *", "remove-old-failed-jobs", async () => {
      const removed = await removeOldFailedJobs(runtime.queues);
      if (removed.length) {
        logInfo("Removed {count} old failed jobs", {
          extra: { count: removed.length },
        });
      }
    });
  }

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
