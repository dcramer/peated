import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import type { z } from "zod";
import {
  FixtureCursorSchema,
  FixtureObservationSchema,
  FixturePageSchema,
  fixtureScraperAdapter,
} from "./adapters/fixture";
import { ScrapeSourceSetupError } from "./configured/setupError";
import { ScraperCoordinationError } from "./coordinator";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
  ScraperTargetDisabledError,
} from "./definitions";
import type { ScraperHttpClock } from "./http";
import { ScraperRequestWaitError } from "./http";
import { executeScraperRun, extendRunTimeout } from "./runs";
import { ScraperRunTakenOverError } from "./session";
import { syncScraperDefinitions } from "./syncDefinitions";
import type { ScraperAdapter, ScraperSink } from "./types";

type FixtureCursor = z.infer<typeof FixtureCursorSchema>;
type FixtureObservation = z.infer<typeof FixtureObservationSchema>;
type FixturePage = {
  items: FixtureObservation[];
  nextPage: number | null;
};

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
  cursor,
  targetEnabled = true,
}: {
  requestLimit?: number;
  adapter?: ScraperAdapter<FixtureCursor, FixtureObservation>;
  sink?: ScraperSink<FixtureObservation>;
  cursor?: unknown;
  targetEnabled?: boolean;
} = {}) {
  const observations = new Map<string, FixtureObservation>();
  const sourceSink: ScraperSink<FixtureObservation> =
    sink ??
    (async ({ observation }) => {
      observations.set(observation.sourceKey, observation.value);
      return { newItemCount: 1, existingItemCount: 0 };
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
        externalSiteKey: "finedrams",
        targetKeys: ["fixture-target"],
        cursorSchema: FixtureCursorSchema,
        observationSchema: FixtureObservationSchema,
        adapter,
        sink: sourceSink,
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

function pageFetch(pages: { [page: number]: FixturePage }) {
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
    newItemCount: 2,
    existingItemCount: 0,
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
    error: "The source is disabled.",
  });
});

test("stores an expected setup failure without failing the worker", async () => {
  const adapter: ScraperAdapter<
    FixtureCursor,
    FixtureObservation
  > = async () => {
    throw new ScrapeSourceSetupError("AI setup needs attention.", [
      { field: "detail.name", message: "The name was not found." },
    ]);
  };
  const { registry, run } = await setupRun({ adapter });

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, clock: fixedClock(), executionToken: "owner" },
    ),
  ).resolves.toEqual({ status: "completed" });

  const [stored] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored).toMatchObject({
    status: "failed",
    error: "AI setup stopped. AI setup needs attention. Check: Item name.",
  });
});

test("waits at the request limit and resumes the same run from its saved place", async () => {
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
    status: "waiting",
    nextAttemptAt: new Date("2026-08-18T12:01:00Z"),
  });
  const [waiting] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(waiting).toMatchObject({
    status: "queued",
    attemptCount: 0,
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
    attemptCount: 1,
    sliceRequestCount: 1,
    requestCount: 2,
  });
  expect(observations.size).toBe(2);
});

test("does not count planned spacing as another run attempt", async () => {
  const adapter: ScraperAdapter<FixtureCursor, FixtureObservation> = async ({
    cursor,
    session,
  }) => {
    let page = cursor?.page ?? 1;
    while (true) {
      const response = await session.request({
        target: "fixture-target",
        url: new URL(`/catalog?page=${page}`, "https://fixture.invalid"),
        canResumeLater: true,
      });
      const parsed = FixturePageSchema.parse(JSON.parse(response.body));
      for (const item of parsed.items) {
        await session.emit({ sourceKey: item.id, value: item });
      }
      if (parsed.nextPage === null) return;
      await session.checkpoint({ page: parsed.nextPage });
      page = parsed.nextPage;
    }
  };
  const { registry, run, observations } = await setupRun({ adapter });
  const fetchImpl = pageFetch({
    1: { items: [{ id: "a", value: "A" }], nextPage: 2 },
    2: { items: [{ id: "b", value: "B" }], nextPage: null },
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      { registry, fetchImpl, clock: fixedClock(), executionToken: "first" },
    ),
  ).resolves.toEqual({
    status: "waiting",
    nextAttemptAt: new Date("2026-08-18T12:00:30Z"),
  });
  const [waiting] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(waiting).toMatchObject({
    status: "queued",
    attemptCount: 0,
    requestCount: 1,
    cursor: { page: 2 },
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry,
        fetchImpl,
        clock: fixedClock("2026-08-18T12:00:30Z"),
        executionToken: "second",
      },
    ),
  ).resolves.toEqual({ status: "completed" });
  const [completed] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(completed).toMatchObject({
    status: "succeeded",
    attemptCount: 1,
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

test("gives a worker more time to finish its run", async () => {
  const { run } = await setupRun();
  await db
    .update(externalSiteRuns)
    .set({
      status: "running",
      executionToken: "slow-worker",
      executionExpiresAt: new Date("2026-08-18T13:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));

  await extendRunTimeout({
    runId: run.id,
    executionToken: "slow-worker",
    now: new Date("2026-08-18T12:30:00Z"),
  });
  const [stored] = await db
    .select({ executionExpiresAt: externalSiteRuns.executionExpiresAt })
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(stored?.executionExpiresAt).toEqual(new Date("2026-08-18T13:30:00Z"));
});

test("an old worker cannot save after another worker takes over", async () => {
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
    { registry, clock: fixedClock(), executionToken: "old-worker" },
  );
  await ready;
  await db
    .update(externalSiteRuns)
    .set({
      executionToken: "new-worker",
      executionExpiresAt: new Date("2026-08-18T13:00:00Z"),
    })
    .where(eq(externalSiteRuns.id, run.id));
  resume?.();

  await expect(execution).rejects.toBeInstanceOf(ScraperRunTakenOverError);
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

test("does not claim a queued run before its next attempt", async () => {
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
  ).resolves.toEqual({ status: "waiting", nextAttemptAt });
  expect(adapter).not.toHaveBeenCalled();
});

test.each(["collect", "suggest"] as const)(
  "fails a %s run before an eleventh execution claim",
  async (purpose) => {
    const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
    const { registry, run } = await setupRun({ adapter });
    await db
      .update(externalSiteRuns)
      .set({
        attemptCount: 10,
        purpose,
        cursor:
          purpose === "suggest"
            ? {
                modelCallCount: 2,
                setup: {
                  conversation: [
                    { role: "user", content: "Public setup evidence" },
                  ],
                  model: "test-model",
                  testCount: 0,
                  readCount: 0,
                  crawl: null,
                },
              }
            : { page: 2 },
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
      cursor: purpose === "suggest" ? { modelCallCount: 2 } : { page: 2 },
    });
    expect(stored!.cursor).not.toHaveProperty("setup");
  },
);

test("fails a waiting run after its maximum lifetime", async () => {
  const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
  const { registry, run } = await setupRun({ adapter });
  await db
    .update(externalSiteRuns)
    .set({
      createdAt: new Date("2026-08-15T11:59:59Z"),
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
      throw new ScraperRequestWaitError(
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

test("waits after temporary traffic coordination failures", async () => {
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
    status: "waiting",
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

test.each(["collect", "suggest"] as const)(
  "invalid %s cursor fails before adapter or network execution",
  async (purpose) => {
    const adapter = vi.fn<ScraperAdapter<FixtureCursor, FixtureObservation>>();
    const { registry, run } = await setupRun({
      adapter,
      cursor:
        purpose === "collect"
          ? { page: "private invalid data" }
          : "invalid setup cursor",
    });
    await db
      .update(externalSiteRuns)
      .set({ purpose })
      .where(eq(externalSiteRuns.id, run.id));
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
      error: "The source returned data we could not use.",
    });
  },
);
