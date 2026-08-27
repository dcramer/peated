import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { beforeEach, expect, test, vi } from "vitest";
import indexBottleSeriesSearchVectors from "./indexBottleSeriesSearchVectors";

beforeEach(() => {
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("skips stale work for a deleted BottleSeries", async () => {
  await expect(
    indexBottleSeriesSearchVectors({ seriesId: 2_147_483_647 }),
  ).resolves.toBeUndefined();
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});
