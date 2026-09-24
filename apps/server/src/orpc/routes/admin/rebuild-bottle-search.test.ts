import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
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
  const page = await routerClient.admin.rebuildBottleSearch(
    { limit: 1 },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: first.id });
  const last = await routerClient.admin.rebuildBottleSearch(
    { afterId: page.nextAfterId!, limit: 1 },
    { context: { user: admin } },
  );
  expect(last).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls.map((args) => args[1])).toEqual([
    { bottleId: first.id },
    { bottleId: second.id },
  ]);
  expect(pushUniqueJob.mock.calls[0][2]).toEqual({ delay: 0, lifo: true });
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
  const page = await routerClient.admin.rebuildBottleSearch(
    { missingOnly: true },
    { context: { user: admin } },
  );
  expect(page).toEqual({ queued: 1, nextAfterId: null });
  expect(pushUniqueJob.mock.calls.map((args) => args[1])).toEqual([
    { bottleId: missing.id },
  ]);
});

test("requires administrator access before enqueueing search work", async ({
  fixtures,
}) => {
  const user = await fixtures.User();
  await expect(
    routerClient.admin.rebuildBottleSearch({}, { context: { user } }),
  ).rejects.toThrow();
  expect(pushUniqueJob).not.toHaveBeenCalled();
});
