import type { JobsOptions } from "bullmq";
import { expect, test } from "vitest";
import { buildUniqueJobOptions } from "./client";

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
