import { db } from "@peated/server/db";
import { bottleSeries, bottles, entities } from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

beforeEach(() => vi.clearAllMocks());

test("pages search rebuilds by stable ID without skipping or duplicating Bottles", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const first = await fixtures.Bottle();
  const second = await fixtures.Bottle();
  pushUniqueJob.mockClear();
  const page = await routerClient.admin.rebuildSearch(
    { limit: 1 },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: first.id });
  const last = await routerClient.admin.rebuildSearch(
    { afterId: page.nextAfterId!, limit: 1 },
    { context: { user: admin } },
  );
  expect(last).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls.map((args) => args[1])).toEqual([
    { bottleId: first.id },
    { bottleId: second.id },
  ]);
});

test("queues only Bottles without search documents when repairing", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const indexed = await fixtures.Bottle();
  const missing = await fixtures.Bottle();
  await db
    .update(bottles)
    .set({ searchNames: "indexed", searchTerms: "indexed" })
    .where(eq(bottles.id, indexed.id));
  await db
    .update(bottles)
    .set({ searchNames: "", searchTerms: "" })
    .where(eq(bottles.id, missing.id));
  pushUniqueJob.mockClear();
  const page = await routerClient.admin.rebuildSearch(
    { missingOnly: true },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls.map((args) => args[1])).toEqual([
    { bottleId: missing.id },
  ]);
});

test("queues Entity index jobs for the Entity scope", async ({ fixtures }) => {
  const admin = await fixtures.User({ admin: true });
  await fixtures.Entity();
  const missing = await fixtures.Entity();
  await db
    .update(entities)
    .set({ searchNames: "" })
    .where(eq(entities.id, missing.id));
  pushUniqueJob.mockClear();
  const page = await routerClient.admin.rebuildSearch(
    { scope: "entities", missingOnly: true },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls).toEqual([
    ["IndexEntitySearchVectors", { entityId: missing.id }, { delay: 0 }],
  ]);
});

test("queues Series index jobs for the Series scope", async ({ fixtures }) => {
  const admin = await fixtures.User({ admin: true });
  const series = await fixtures.BottleSeries();
  await db
    .update(bottleSeries)
    .set({ searchNames: "" })
    .where(eq(bottleSeries.id, series.id));
  pushUniqueJob.mockClear();
  const page = await routerClient.admin.rebuildSearch(
    { scope: "series", missingOnly: true },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls).toEqual([
    ["IndexBottleSeriesSearchVectors", { seriesId: series.id }, { delay: 0 }],
  ]);
});

test("requires administrator access before enqueueing search work", async ({
  fixtures,
}) => {
  const user = await fixtures.User();
  await expect(
    routerClient.admin.rebuildSearch({}, { context: { user } }),
  ).rejects.toThrow();
  expect(pushUniqueJob).not.toHaveBeenCalled();
});
