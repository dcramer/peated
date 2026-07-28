import * as workerClient from "@peated/server/worker/client";
import { beforeEach, expect, test, vi } from "vitest";
import onBottleChange, { buildBottleChangeStatsJob } from "./onBottleChange";

beforeEach(() => {
  vi.mocked(workerClient.runJob).mockClear();
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("builds direct Bottle statistics work", () => {
  expect(buildBottleChangeStatsJob(42)).toEqual({
    name: "UpdateBottleStats",
    args: { bottleId: 42 },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  });
});

test("dispatches derived work for the supplied Bottle", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();

  await onBottleChange({ bottleId: bottle.id });

  expect(workerClient.runJob).toHaveBeenCalledWith("GenerateBottleDetails", {
    bottleId: bottle.id,
  });
  expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleSearchVectors", {
    bottleId: bottle.id,
  });
  expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
    "UpdateBottleStats",
    { bottleId: bottle.id },
    { delay: 5000, removeOnComplete: true, removeOnFail: false },
  );
});

test.each([
  undefined,
  {},
  { bottleId: 0 },
  { bottleId: -1 },
  { bottleId: 1.5 },
  { bottleId: "1" },
  { bottleId: 1, unexpected: true },
  { legacyId: 1 },
])("rejects malformed job input %#", async (input) => {
  await expect(onBottleChange(input)).rejects.toThrow();
});
