import { expect, test } from "vitest";
import { buildBottleChangeStatsJob } from "./onBottleChange";

test("builds the statistics job for a Bottle change", () => {
  expect(buildBottleChangeStatsJob(42)).toEqual({
    name: "UpdateBottleStats",
    args: { bottleId: 42, entityStatsBottleId: 42 },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  });
});
