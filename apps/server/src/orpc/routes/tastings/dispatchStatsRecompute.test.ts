import * as workerClient from "@peated/server/worker/client";
import { beforeEach, expect, test, vi } from "vitest";
import {
  buildTastingStatsRecomputeJob,
  dispatchTastingStatsRecompute,
} from "./dispatchStatsRecompute";

vi.mock("@peated/server/worker/client", async (importOriginal) => ({
  ...(await importOriginal<typeof workerClient>()),
  pushJob: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
});

test("builds a direct Bottle recomputation payload", () => {
  expect(buildTastingStatsRecomputeJob(40)).toEqual({
    name: "UpdateBottleStats",
    args: { bottleId: 40 },
  });
});

test("queues independent delayed work and does not fail the committed request", async () => {
  vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
    new Error("queue unavailable"),
  );

  await expect(dispatchTastingStatsRecompute(10, 40)).resolves.toBeUndefined();

  expect(workerClient.pushJob).toHaveBeenCalledWith(
    "UpdateBottleStats",
    { bottleId: 40 },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
});
