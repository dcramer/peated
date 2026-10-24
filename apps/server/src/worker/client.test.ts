import type { JobsOptions } from "bullmq";
import { expect, test, vi } from "vitest";
import {
  buildUniqueJobOptions,
  generateUniqIdentifier,
  removeFinishedJob,
} from "./client";
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

test("removes a finished job with the same unique ID so the work can queue again", async () => {
  for (const finished of [
    { isCompleted: async () => true, isFailed: async () => false },
    { isCompleted: async () => false, isFailed: async () => true },
  ]) {
    const remove = vi.fn();
    const queue = { getJob: async () => ({ ...finished, remove }) };

    await removeFinishedJob(queue, "IndexBottleSearch-1");

    expect(remove).toHaveBeenCalledOnce();
  }
});

test("keeps an unfinished job with the same unique ID", async () => {
  const remove = vi.fn();
  const queue = {
    getJob: async () => ({
      isCompleted: async () => false,
      isFailed: async () => false,
      remove,
    }),
  };

  await removeFinishedJob(queue, "IndexBottleSearch-1");

  expect(remove).not.toHaveBeenCalled();
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

test("a unique job keeps its generated ID over a caller's job ID", () => {
  expect(
    buildUniqueJobOptions(
      "OnEntityChange",
      { entityId: 1383 },
      { jobId: "caller-chosen" },
    ).jobId,
  ).toBe(generateUniqIdentifier("OnEntityChange", { entityId: 1383 }));
});
