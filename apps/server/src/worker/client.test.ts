import type { JobsOptions } from "bullmq";
import { expect, test, vi } from "vitest";
import { buildUniqueJobOptions, removeFailedJob } from "./client";

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

test("removes a failed job with the same unique ID so the work can queue again", async () => {
  const remove = vi.fn();
  const queue = {
    getJob: async () => ({ isFailed: async () => true, remove }),
  };

  await removeFailedJob(queue, "IndexBottleSearchVectors-1");

  expect(remove).toHaveBeenCalledOnce();
});

test("keeps an unfinished job with the same unique ID", async () => {
  const remove = vi.fn();
  const queue = {
    getJob: async () => ({ isFailed: async () => false, remove }),
  };

  await removeFailedJob(queue, "IndexBottleSearchVectors-1");

  expect(remove).not.toHaveBeenCalled();
});
