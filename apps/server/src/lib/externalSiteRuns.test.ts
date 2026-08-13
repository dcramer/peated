import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import {
  createExternalSiteRunJob,
  ExternalSiteRunActiveError,
  queueManualExternalSiteRun,
  queueScheduledExternalSiteRun,
  redispatchStaleExternalSiteRuns,
} from "@peated/server/lib/externalSiteRuns";
import * as Sentry from "@sentry/node";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";

test("manual run is attributed, dispatched deterministically, and does not move schedule", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const nextRunAt = new Date(Date.now() + 60_000);
  const site = await fixtures.ExternalSite({
    type: "decadentdrinks",
    nextRunAt,
  });
  const enqueue = vi.fn(async () => undefined);

  const run = await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue,
  });

  expect(run).toMatchObject({
    externalSiteId: site.id,
    status: "queued",
    trigger: "manual",
    requestedById: requestedBy.id,
  });
  expect(enqueue).toHaveBeenCalledWith(
    "ScrapeDecadentDrinks",
    { runId: run.id },
    {
      jobId: `external-site-run-${run.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  const [storedSite] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.id, site.id));
  expect(storedSite?.nextRunAt).toEqual(nextRunAt);
  expect(storedSite?.lastRunAt).toBeNull();
});

test("worker owns successful lifecycle and terminal delivery is a no-op", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const run = await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue: async () => undefined,
  });
  const scrape = vi.fn(async () => 7);
  const job = createExternalSiteRunJob("decadentdrinks", scrape);

  await job({ runId: run.id });
  await job({ runId: run.id });

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  const [storedSite] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.id, site.id));
  expect(storedRun).toMatchObject({
    status: "succeeded",
    attemptCount: 1,
    itemCount: 7,
    error: null,
  });
  expect(storedRun?.startedAt).not.toBeNull();
  expect(storedRun?.completedAt).not.toBeNull();
  expect(storedSite?.lastRunId).toBe(run.id);
  expect(storedSite?.lastRunAt).toEqual(storedRun?.completedAt);
  expect(scrape).toHaveBeenCalledOnce();
});

test("worker persists a safe failure and rethrows", async ({ fixtures }) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const run = await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue: async () => undefined,
  });
  const failure = new Error("secret provider response");
  const job = createExternalSiteRunJob("decadentdrinks", async () => {
    throw failure;
  });

  await Sentry.withIsolationScope(async (scope) => {
    await expect(job({ runId: run.id })).rejects.toBe(failure);
    expect(scope.getScopeData().contexts?.externalSiteRun).toEqual({
      id: run.id,
      site: "decadentdrinks",
    });
  });

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun).toMatchObject({
    status: "failed",
    attemptCount: 1,
    error: "Unexpected scraper failure. See Sentry for this run.",
  });
  expect(storedRun?.error).not.toContain("secret");
});

test("active run prevents overlap", async ({ fixtures }) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue: async () => undefined,
  });

  await expect(
    queueManualExternalSiteRun({
      site,
      requestedById: requestedBy.id,
      enqueue: async () => undefined,
    }),
  ).rejects.toBeInstanceOf(ExternalSiteRunActiveError);
});

test("dispatch failure is terminal and a scheduled site becomes due", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "decadentdrinks",
    runEvery: 60,
    nextRunAt: null,
  });
  const failure = new Error("redis unavailable");

  await expect(
    queueScheduledExternalSiteRun(site.id, async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);

  const [run] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.externalSiteId, site.id));
  const [storedSite] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.id, site.id));
  expect(run).toMatchObject({
    status: "failed",
    trigger: "scheduled",
    error: "Unable to dispatch scraper job.",
  });
  expect(storedSite?.lastRunId).toBe(run?.id);
  expect(storedSite?.lastRunAt).toEqual(run?.completedAt);
  expect(storedSite?.nextRunAt?.getTime()).toBeLessThanOrEqual(Date.now());
});

test("stale active runs are redispatched with their existing queue identity", async ({
  fixtures,
}) => {
  const queuedSite = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const runningSite = await fixtures.ExternalSite({ type: "cadenheads" });
  const freshSite = await fixtures.ExternalSite({ type: "smws" });
  const staleAt = new Date("2026-01-01T00:00:00Z");
  const staleBefore = new Date("2026-01-01T00:10:00Z");
  const freshAt = new Date("2026-01-01T00:20:00Z");
  const [queuedRun, runningRun] = await db
    .insert(externalSiteRuns)
    .values([
      {
        externalSiteId: queuedSite.id,
        trigger: "scheduled",
        createdAt: staleAt,
      },
      {
        externalSiteId: runningSite.id,
        trigger: "scheduled",
        status: "running",
        createdAt: staleAt,
        startedAt: staleAt,
      },
      {
        externalSiteId: freshSite.id,
        trigger: "scheduled",
        createdAt: freshAt,
      },
    ])
    .returning();
  const enqueue = vi.fn(async () => undefined);

  const count = await redispatchStaleExternalSiteRuns({
    staleBefore,
    enqueue,
  });

  expect(count).toBe(2);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue).toHaveBeenCalledWith(
    "ScrapeDecadentDrinks",
    { runId: queuedRun?.id },
    {
      jobId: `external-site-run-${queuedRun?.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  expect(enqueue).toHaveBeenCalledWith(
    "ScrapeCadenheads",
    { runId: runningRun?.id },
    {
      jobId: `external-site-run-${runningRun?.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
});

test("failed stale-run redispatch preserves the active run", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "scheduled",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })
    .returning();
  const failure = new Error("redis unavailable");

  await expect(
    redispatchStaleExternalSiteRuns({
      staleBefore: new Date("2026-01-01T00:10:00Z"),
      enqueue: async () => {
        throw failure;
      },
    }),
  ).rejects.toBe(failure);

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run!.id));
  expect(storedRun).toMatchObject({
    status: "queued",
    completedAt: null,
    error: null,
  });
});

test("scheduled run advances scheduling without claiming completion", async ({
  fixtures,
}) => {
  const before = Date.now();
  const site = await fixtures.ExternalSite({
    type: "decadentdrinks",
    runEvery: 60,
    nextRunAt: null,
  });

  const run = await queueScheduledExternalSiteRun(
    site.id,
    async () => undefined,
  );

  const [storedSite] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.id, site.id));
  expect(run).toMatchObject({ status: "queued", trigger: "scheduled" });
  expect(storedSite?.nextRunAt?.getTime()).toBeGreaterThanOrEqual(
    before + 60 * 60_000,
  );
  expect(storedSite?.lastRunAt).toBeNull();
  expect(storedSite?.lastRunId).toBeNull();
});
