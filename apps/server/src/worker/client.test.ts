import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import config from "../config";
import { buildUniqueJobOptions, generateUniqIdentifier } from "./client";
import registry from "./registry";

test("removes completed unique jobs so later changes can queue them again", () => {
  expect(
    buildUniqueJobOptions("OnEntityChange", { entityId: 1383 }),
  ).toMatchObject({
    delay: 5000,
    removeOnComplete: true,
    removeOnFail: false,
  });
});

test("keeps explicit unique job options", () => {
  const options: JobsOptions = {
    delay: 1000,
    removeOnComplete: false,
    removeOnFail: true,
  };

  expect(
    buildUniqueJobOptions("OnEntityChange", { entityId: 1383 }, options),
  ).toMatchObject(options);
});

test("deduplicates on the job name and arguments, not a caller's job ID", () => {
  const options = buildUniqueJobOptions(
    "OnEntityChange",
    { entityId: 1383 },
    { jobId: "caller-chosen" },
  );

  expect(options.jobId).toBeUndefined();
  expect(options.deduplication).toEqual({
    id: generateUniqIdentifier("OnEntityChange", { entityId: 1383 }),
    keepLastIfActive: true,
  });
});

test("registration makes every push of derived-data work unique", () => {
  // These jobs were once pushed both ways; a plain push queued duplicates.
  for (const jobName of [
    "OnEntityChange",
    "UpdateBottleStats",
    "UpdateEntityStats",
    "ResolveStorePriceBottle",
  ]) {
    expect(registry.isUnique(jobName)).toBe(true);
  }
  // These set their own job IDs or are separate work on every push.
  for (const jobName of ["MergeEntity", "RunScraper", "NotifyReport"]) {
    expect(registry.isUnique(jobName)).toBe(false);
  }
});

// The tests below run BullMQ against the test Redis on a queue of their own,
// so they check what the queue does with these options, not just the options.
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function isolatedQueue() {
  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(`test-unique-${randomUUID()}`, { connection });
  cleanups.push(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
    connection.disconnect();
  });
  return { connection, queue };
}

function uniqueOptions(bottleId: number) {
  return buildUniqueJobOptions("UpdateBottleStats", { bottleId }, { delay: 0 });
}

test("merges pushes that arrive while the job is waiting", async () => {
  const { queue } = await isolatedQueue();

  await queue.add("UpdateBottleStats", { push: 1 }, uniqueOptions(1));
  await queue.add("UpdateBottleStats", { push: 2 }, uniqueOptions(1));
  await queue.add("UpdateBottleStats", { push: 3 }, uniqueOptions(2));

  const counts = await queue.getJobCounts("wait", "delayed");
  expect(counts.wait + counts.delayed).toBe(2);
});

test("runs once more after pushes that arrive mid-run, never in parallel", async () => {
  const { connection, queue } = await isolatedQueue();
  const runs: unknown[] = [];
  let running = 0;
  let maxRunning = 0;
  let releaseFirstRun!: () => void;
  const firstRunHeld = new Promise<void>((resolve) => {
    releaseFirstRun = resolve;
  });
  let firstRunStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    firstRunStarted = resolve;
  });
  let secondRunDone!: () => void;
  const finished = new Promise<void>((resolve) => {
    secondRunDone = resolve;
  });

  const workerConnection = connection.duplicate();
  const worker = new Worker(
    queue.name,
    async (job) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      runs.push(job.data);
      if (runs.length === 1) {
        firstRunStarted();
        await firstRunHeld;
      }
      running -= 1;
      if (runs.length === 2) secondRunDone();
    },
    { connection: workerConnection, concurrency: 4 },
  );
  cleanups.push(async () => {
    await worker.close();
    workerConnection.disconnect();
  });

  await queue.add("UpdateBottleStats", { push: 1 }, uniqueOptions(1));
  await started;
  // Both arrive while the first run holds the job; only the latest is kept.
  await queue.add("UpdateBottleStats", { push: 2 }, uniqueOptions(1));
  await queue.add("UpdateBottleStats", { push: 3 }, uniqueOptions(1));
  releaseFirstRun();
  await finished;

  expect(runs).toEqual([{ push: 1 }, { push: 3 }]);
  expect(maxRunning).toBe(1);
});
