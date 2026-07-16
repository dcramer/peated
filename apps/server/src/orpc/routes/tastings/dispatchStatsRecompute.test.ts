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

test("builds exact and generic recomputation payloads", () => {
  expect(
    buildTastingStatsRecomputeJob(
      {
        targetId: 20,
        groupId: 30,
        bottleId: 40,
      },
      50,
    ),
  ).toEqual({
    name: "UpdateBottleStats",
    args: { bottleId: 40, entityStatsBottleId: 50 },
  });

  expect(
    buildTastingStatsRecomputeJob(
      {
        targetId: 21,
        groupId: 31,
        bottleId: null,
      },
      50,
    ),
  ).toEqual({
    name: "UpdateBottleGroupStats",
    args: { groupId: 31, entityStatsBottleId: 50 },
  });
});

test("queues independent delayed work and does not fail the committed request", async () => {
  vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
    new Error("queue unavailable"),
  );

  await expect(
    dispatchTastingStatsRecompute(
      10,
      {
        targetId: 20,
        groupId: 30,
        bottleId: 40,
      },
      50,
    ),
  ).resolves.toBeUndefined();

  expect(workerClient.pushJob).toHaveBeenCalledWith(
    "UpdateBottleStats",
    { bottleId: 40, entityStatsBottleId: 50 },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
});
