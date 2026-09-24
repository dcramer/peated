import type { JobsOptions } from "bullmq";
import { expect, test, vi } from "vitest";
import { buildUniqueJobOptions, removeFinishedJob } from "./client";

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

    await removeFinishedJob(queue, "IndexBottleSearchVectors-1");

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

  await removeFinishedJob(queue, "IndexBottleSearchVectors-1");

  expect(remove).not.toHaveBeenCalled();
});
