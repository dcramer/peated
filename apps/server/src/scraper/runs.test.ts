import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import type { z } from "zod";
import {
  FixtureCursorSchema,
  FixtureObservationSchema,
  fixtureScraperAdapter,
} from "./adapters/fixture";
import { ScraperCoordinationError } from "./coordinator";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
  ScraperTargetDisabledError,
} from "./definitions";
import type { ScraperHttpClock } from "./http";
import { ScraperRequestDeferredError } from "./http";
import { executeScraperRun } from "./runs";
import { ScraperRunOwnershipError } from "./session";
import { syncScraperDefinitions } from "./syncDefinitions";
import type {
  ScraperAdapter,
  ScraperAuthorization,
  ScraperSink,
} from "./types";

type FixtureCursor = z.infer<typeof FixtureCursorSchema>;
type FixtureObservation = z.infer<typeof FixtureObservationSchema>;

function fixedClock(value = "2026-08-18T12:00:00Z"): ScraperHttpClock {
  let now = new Date(value);
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
  };
}

async function setupRun({
  requestLimit = 100,
  adapter = fixtureScraperAdapter,
  sink,
  authorize,
  cursor,
  targetEnabled = true,
}: {
  requestLimit?: number;
  adapter?: ScraperAdapter<FixtureCursor, FixtureObservation>;
  sink?: ScraperSink<FixtureObservation>;
  authorize?: ScraperAuthorization;
  cursor?: unknown;
  targetEnabled?: boolean;
} = {}) {
  const observations = new Map<string, FixtureObservation>();
  const sourceSink: ScraperSink<FixtureObservation> =
    sink ??
    (async ({ observation }) => {
      observations.set(observation.sourceKey, observation.value);
    });
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "fixture-target",
        enabled: targetEnabled,
        origins: [
          {
            origin: "https://fixture.invalid",
            robots: {
              mode: "not_applicable",
              rationale:
                "Reserved fixture origin used only by deterministic tests.",
            },
          },
        ],
      }),
    ],
    sources: [
      defineScraperSource({
        key: "fixture-source",
        externalSiteType: "finedrams",
        targetKeys: ["fixture-target"],
        requestLimit,
        cursorSchema: FixtureCursorSchema,
        observationSchema: FixtureObservationSchema,
        adapter,
        sink: sourceSink,
        authorize,
      }),
    ],
  });
  const [site] = await db
    .insert(externalSites)
    .values({ type: "finedrams", name: "Fixture source" })
    .returning();
  if (!site) throw new Error("Expected site.");
  await syncScraperDefinitions(registry);
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit,
      cursor,
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  return { registry, run, observations };
}

function pageFetch(pages: Record<number, object>) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const page = Number(url.searchParams.get("page"));
    return new Response(JSON.stringify(pages[page]));
  });
}

test("executes the fixture adapter through request, emit, checkpoint, and completion", async () => {
  const { registry, run, observations } = await setupRun();
  const fetchImpl = pageFetch({
    1: { items: [{ id: "a", value: "A" }], nextPage: 2 },
    2: { items: [{ id: "b", value: "B" }], nextPage: null },
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, fetchImpl, clock: fixedClock(), executionToken: "owner" },
    ),
  ).resolves.toEqual({ status: "completed" });
  expect(observations).toEqual(
    new Map([
      ["a", { id: "a", value: "A" }],
      ["b", { id: "b", value: "B" }],
    ]),
  );
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "succeeded",
    attemptCount: 1,
    sliceRequestCount: 2,
    requestCount: 2,
    emittedItemCount: 2,
    itemCount: 2,
    cursor: { page: 2 },
    executionToken: null,
  });
});

test("fails a queued run before adapter execution when its target is disabled", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
  const { registry, run } = await setupRun({
    adapter,
    targetEnabled: false,
  });
  const fetchImpl = vi.fn<typeof fetch>();

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, fetchImpl, clock: fixedClock(), executionToken: "owner" },
    ),
  ).rejects.toBeInstanceOf(ScraperTargetDisabledError);
  expect(adapter).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();

  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    attemptCount: 1,
    requestCount: 0,
    error: "Scraper target fixture-target is disabled.",
  });
});

test("defers at the slice budget and resumes the same run from its cursor", async () => {
  const { registry, run, observations } = await setupRun({ requestLimit: 1 });
  const fetchImpl = pageFetch({
    1: { items: [{ id: "a", value: "A" }], nextPage: 2 },
    2: { items: [{ id: "b", value: "B" }], nextPage: null },
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, fetchImpl, clock: fixedClock(), executionToken: "slice-1" },
    ),
  ).resolves.toEqual({
    status: "deferred",
    nextAttemptAt: new Date("2026-08-18T12:01:00Z"),
  });
  const [deferred] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(deferred).toMatchObject({
    status: "queued",
    cursor: { page: 2 },
    sliceRequestCount: 1,
    requestCount: 1,
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry,
        fetchImpl,
        clock: fixedClock("2026-08-18T12:01:00Z"),
        executionToken: "slice-2",
      },
    ),
  ).resolves.toEqual({ status: "completed" });
  const [completed] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(completed).toMatchObject({
    id: run.id,
    status: "succeeded",
    attemptCount: 2,
    sliceRequestCount: 1,
    requestCount: 2,
  });
  expect(observations.size).toBe(2);
});

test("duplicate delivery cannot advance an actively owned run", async () => {
  let entered: (() => void) | undefined;
  let finish: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const adapter: ScraperAdapter<
    FixtureCursor,
    FixtureObservation
  > = async () => {
    entered?.();
    await blocked;
  };
  const { registry, run } = await setupRun({ adapter });

  const first = executeScraperRun(
    { runId: run.id },
    { registry, clock: fixedClock(), executionToken: "first-owner" },
  );
  await started;
  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "duplicate-owner" },
    ),
  ).resolves.toEqual({ status: "duplicate" });
  finish?.();
  await expect(first).resolves.toEqual({ status: "completed" });
});

test("a reclaimed execution cannot emit through the prior owner's sink", async () => {
  let entered: (() => void) | undefined;
  let resume: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const sink = vi.fn<ScraperSink<FixtureObservation>>();
  const adapter: ScraperAdapter<FixtureCursor, FixtureObservation> = async ({
    session,
  }) => {
    entered?.();
    await blocked;
    await session.emit({
      sourceKey: "stale",
      value: { id: "stale", value: "Stale" },
    });
  };
  const { registry, run } = await setupRun({ adapter, sink });
  const execution = executeScraperRun(
    { runId: run.id },
    { registry, clock: fixedClock(), executionToken: "prior-owner" },
  );
  await ready;
  await db
    .update(externalSiteRuns)
    .set({
      executionToken: "successor-owner",
      executionExpiresAt: new Date("2026-08-18T13:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));
  resume?.();

  await expect(execution).rejects.toBeInstanceOf(ScraperRunOwnershipError);
  expect(sink).not.toHaveBeenCalled();
});

test("reclaims an expired execution lease without changing run identity", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>(
    async () => {},
  );
  const { registry, run } = await setupRun({ adapter });
  await db
    .update(externalSiteRuns)
    .set({
      status: "running",
      executionToken: "crashed-worker",
      executionExpiresAt: new Date("2026-08-18T11:59:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "recovery-worker" },
    ),
  ).resolves.toEqual({ status: "completed" });
  expect(adapter).toHaveBeenCalledOnce();
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({ id: run.id, status: "succeeded" });
});

test("does not claim a queued run before its durable next-attempt time", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>(
    async () => {},
  );
  const { registry, run } = await setupRun({ adapter });
  const nextAttemptAt = new Date("2026-08-18T12:05:00Z");
  await db
    .update(externalSiteRuns)
    .set({ nextAttemptAt })
    .where(eq(externalSiteRuns.id, run.id));

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "early-worker" },
    ),
  ).resolves.toEqual({ status: "not_ready", nextAttemptAt });
  expect(adapter).not.toHaveBeenCalled();
});

test("fails a run before an eleventh execution claim", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
  const { registry, run } = await setupRun({ adapter });
  await db
    .update(externalSiteRuns)
    .set({
      attemptCount: 10,
      nextAttemptAt: new Date("2026-08-19T12:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "next-owner" },
    ),
  ).resolves.toEqual({ status: "completed" });
  expect(adapter).not.toHaveBeenCalled();
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    error: "Scraper run exceeded its execution limits.",
    nextAttemptAt: null,
  });
});

test("fails a deferred run after its maximum lifetime", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
  const { registry, run } = await setupRun({ adapter });
  await db
    .update(externalSiteRuns)
    .set({
      createdAt: new Date("2026-08-17T11:59:59Z"),
      nextAttemptAt: new Date("2026-08-19T12:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "next-owner" },
    ),
  ).resolves.toEqual({ status: "completed" });
  expect(adapter).not.toHaveBeenCalled();
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    error: "Scraper run exceeded its execution limits.",
  });
});

test("replay-safe sink prevents duplicate records after a lost checkpoint", async () => {
  let attempt = 0;
  const adapter: ScraperAdapter<FixtureCursor, FixtureObservation> = async ({
    session,
  }) => {
    await session.emit({
      sourceKey: "same",
      value: { id: "same", value: "value" },
    });
    attempt += 1;
    if (attempt === 1) {
      throw new ScraperRequestDeferredError(
        "target_cooldown",
        new Date("2026-08-18T12:01:00Z"),
      );
    }
  };
  const { registry, run, observations } = await setupRun({ adapter });

  await executeScraperRun(
    { runId: run.id },
    { registry, clock: fixedClock(), executionToken: "first" },
  );
  await executeScraperRun(
    { runId: run.id },
    {
      registry,
      clock: fixedClock("2026-08-18T12:01:00Z"),
      executionToken: "second",
    },
  );
  expect(observations).toEqual(
    new Map([["same", { id: "same", value: "value" }]]),
  );
});

test("defers transient traffic coordination failures", async () => {
  const adapter: ScraperAdapter<
    FixtureCursor,
    FixtureObservation
  > = async () => {
    throw new ScraperCoordinationError(new Error("database unavailable"));
  };
  const { registry, run } = await setupRun({ adapter });

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "owner" },
    ),
  ).resolves.toEqual({
    status: "deferred",
    nextAttemptAt: new Date("2026-08-18T12:15:00Z"),
  });
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "queued",
    nextAttemptAt: new Date("2026-08-18T12:15:00Z"),
    error: null,
  });
});

test("rechecks source authorization after a queued wait", async () => {
  let allowed = true;
  const authorize = vi.fn(async () => {
    if (!allowed)
      throw new Error("source capability revoked with private detail");
  });
  const adapter: ScraperAdapter<
    FixtureCursor,
    FixtureObservation
  > = async () => {
    throw new ScraperRequestDeferredError(
      "target_cooldown",
      new Date("2026-08-18T12:01:00Z"),
    );
  };
  const { registry, run } = await setupRun({ adapter, authorize });
  await executeScraperRun(
    { runId: run.id },
    { registry, clock: fixedClock(), executionToken: "first" },
  );
  allowed = false;

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry,
        clock: fixedClock("2026-08-18T12:01:00Z"),
        executionToken: "second",
      },
    ),
  ).rejects.toThrow(/source capability revoked/);
  expect(authorize).toHaveBeenCalledTimes(2);
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    error: "Unexpected scraper failure. See Sentry for this run.",
  });
});

test("invalid persisted cursor fails before adapter or network execution", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
  const { registry, run } = await setupRun({
    adapter,
    cursor: { page: "private invalid data" },
  });
  const fetchImpl = vi.fn<typeof fetch>();

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, fetchImpl, clock: fixedClock(), executionToken: "owner" },
    ),
  ).rejects.toBeDefined();
  expect(adapter).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    error: "Scraper data failed validation.",
  });
});
