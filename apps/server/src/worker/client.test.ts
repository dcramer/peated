import type { JobsOptions } from "bullmq";
import { expect, test, vi } from "vitest";
import {
  buildUniqueJobOptions,
  claimUniqueJobId,
  generateUniqIdentifier,
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

function fakeQueue(states: Record<string, string>) {
  const removed: string[] = [];
  return {
    removed,
    async getJob(jobId: string) {
      const state = states[jobId];
      if (!state) return undefined;
      return {
        getState: async () => state,
        remove: async () => {
          removed.push(jobId);
        },
      };
    },
  };
}

test("reuses the unique ID after removing a finished job", async () => {
  for (const state of ["completed", "failed"]) {
    const queue = fakeQueue({ "UpdateBottleStats-1": state });

    await expect(claimUniqueJobId(queue, "UpdateBottleStats-1")).resolves.toBe(
      "UpdateBottleStats-1",
    );
    expect(queue.removed).toEqual(["UpdateBottleStats-1"]);
  }
});

test("lets a waiting or delayed job absorb the push", async () => {
  for (const state of ["waiting", "delayed"]) {
    const queue = fakeQueue({ "UpdateBottleStats-1": state });

    await expect(claimUniqueJobId(queue, "UpdateBottleStats-1")).resolves.toBe(
      "UpdateBottleStats-1",
    );
    expect(queue.removed).toEqual([]);
  }
});

test("queues one follow-up behind a running job so a later write is not lost", async () => {
  const queue = fakeQueue({ "UpdateBottleStats-1": "active" });

  await expect(claimUniqueJobId(queue, "UpdateBottleStats-1")).resolves.toBe(
    "UpdateBottleStats-1-rerun",
  );

  // A finished follow-up from an earlier run is cleared so it can queue again.
  const withOldFollowUp = fakeQueue({
    "UpdateBottleStats-1": "active",
    "UpdateBottleStats-1-rerun": "completed",
  });
  await expect(
    claimUniqueJobId(withOldFollowUp, "UpdateBottleStats-1"),
  ).resolves.toBe("UpdateBottleStats-1-rerun");
  expect(withOldFollowUp.removed).toEqual(["UpdateBottleStats-1-rerun"]);
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
