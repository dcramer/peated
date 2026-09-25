import { db } from "@peated/server/db";
import { bottleSeries } from "@peated/server/db/schema";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { eq, sql } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";
import indexBottleSeriesSearch from "./indexBottleSeriesSearch";

beforeEach(() => {
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("skips stale work for a deleted BottleSeries", async () => {
  await expect(
    indexBottleSeriesSearch({ seriesId: 2_147_483_647 }),
  ).resolves.toBeUndefined();
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});

test("writes a Series search document that TIN can query", async ({
  fixtures,
}) => {
  const brand = await fixtures.Entity({
    name: "Bruichladdich Distillery",
    shortName: "Bruichladdich",
  });
  const series = await fixtures.BottleSeries({
    name: "Octomore",
    brandId: brand.id,
  });
  await db
    .update(bottleSeries)
    .set({ searchNames: "" })
    .where(eq(bottleSeries.id, series.id));

  await indexBottleSeriesSearch({ seriesId: series.id });

  const [row] = await db
    .select({ searchNames: bottleSeries.searchNames })
    .from(bottleSeries)
    .where(eq(bottleSeries.id, series.id));
  expect(row!.searchNames.split("\n")).toEqual([
    "Bruichladdich Octomore",
    "Bruichladdich Distillery",
  ]);
  const matches = await db
    .select({ id: bottleSeries.id })
    .from(bottleSeries)
    .where(sql`${bottleSeries.searchNames} ==> ${'"octomore"'}`);
  expect(matches.map((match) => match.id)).toEqual([series.id]);
});
