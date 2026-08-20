import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSiteRuns,
  externalSites,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import {
  createScraperLifecycle,
  ExternalSiteRunActiveError,
  type ScraperEnqueue,
} from "./lifecycle";
import { scraperRegistry } from "./registry";
import { executeScraperRun } from "./runs";
import { ExternalReviewSourcePolicyError } from "./sourcePolicy";

function lifecycle(enqueue: ScraperEnqueue) {
  return createScraperLifecycle({ registry: scraperRegistry, enqueue });
}

function queueManualExternalSiteRun({
  enqueue,
  ...input
}: Parameters<ReturnType<typeof lifecycle>["queueManualExternalSiteRun"]>[0] & {
  enqueue: ScraperEnqueue;
}) {
  return lifecycle(enqueue).queueManualExternalSiteRun(input);
}

function queueScheduledExternalSiteRun(
  siteId: number,
  enqueue: ScraperEnqueue,
) {
  return lifecycle(enqueue).queueScheduledExternalSiteRun(siteId);
}

function redispatchStaleExternalSiteRuns({
  enqueue,
  ...options
}: Parameters<
  ReturnType<typeof lifecycle>["redispatchStaleExternalSiteRuns"]
>[0] & { enqueue: ScraperEnqueue }) {
  return lifecycle(enqueue).redispatchStaleExternalSiteRuns(options);
}

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
    "RunScraper",
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

test("review runs require the fetching capability before dispatch", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const enqueue = vi.fn(async () => undefined);

  await expect(
    queueManualExternalSiteRun({
      site,
      requestedById: requestedBy.id,
      enqueue,
    }),
  ).rejects.toBeInstanceOf(ExternalReviewSourcePolicyError);

  const runs = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.externalSiteId, site.id));
  expect(runs).toHaveLength(0);
  expect(enqueue).not.toHaveBeenCalled();
});

test("enabled review runs are dispatched", async ({ fixtures }) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
  });
  const enqueue = vi.fn(async () => undefined);

  const run = await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue,
  });

  expect(run.status).toBe("queued");
  expect(enqueue).toHaveBeenCalledOnce();
});

test("worker rechecks the capability after a review run is queued", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.EnabledExternalReviewSourcePolicy({
    externalSiteId: site.id,
  });
  const run = await queueManualExternalSiteRun({
    site,
    requestedById: requestedBy.id,
    enqueue: async () => undefined,
  });
  await db
    .update(externalReviewSourcePolicies)
    .set({
      publicationMode: "disabled",
      allowFetching: false,
      allowLlmProcessing: false,
      allowScoreDisplay: false,
      allowSummaryDisplay: false,
    })
    .where(eq(externalReviewSourcePolicies.externalSiteId, site.id));
  const fetchImpl = vi.fn<typeof fetch>();

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry: scraperRegistry, fetchImpl },
    ),
  ).rejects.toBeInstanceOf(ExternalReviewSourcePolicyError);

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun).toMatchObject({ status: "failed", itemCount: null });
  expect(fetchImpl).not.toHaveBeenCalled();
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
    "RunScraper",
    { runId: queuedRun?.id },
    {
      jobId: `external-site-run-${queuedRun?.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  expect(enqueue).toHaveBeenCalledWith(
    "RunScraper",
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
