import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeTargets,
  users,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { createScraperRegistry } from "../definitions";
import type { ScraperHttpClock } from "../http";
import { createScraperLifecycle, type ScraperEnqueue } from "../lifecycle";
import { executeScraperRun } from "../runs";
import type { ScrapeRules } from "./rules";
import {
  createPinnedScrapeSourceRun,
  createScrapeSourceSuggestionRun,
  ScrapeSourceSuggestionCursorSchema,
} from "./runs";
import {
  activateScrapeSourceRevision,
  createScrapeSourceRevision,
  createSiteWithScrapeSource,
  pauseScrapeSource,
} from "./service";
import type { SetupAgentModelRequest } from "./setupAgent";
import type { RequestScrapeSourceModel } from "./suggestion";

const requestModel = vi.fn<RequestScrapeSourceModel>();

const oldRules = {
  kind: "review",
  list: {
    links: "a.review",
    nextPage: null,
    limit: 5,
  },
  detail: {
    url: null,
    title: "h1",
    date: "time",
    reviews: {
      area: "body",
      item: "article.review",
      name: "h3",
      reviewer: null,
      tastingNotes: ".body",
      score: null,
    },
  },
} as const satisfies ScrapeRules;

const repairedRules = {
  ...oldRules,
  detail: { ...oldRules.detail, title: "h1, h2.page-title" },
} as const satisfies ScrapeRules;

type TestClock = ScraperHttpClock & { advanceTo(value: Date): void };

function testClock(start = "2026-09-09T12:00:00Z"): TestClock {
  let now = new Date(start);
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
    advanceTo: (value) => {
      now = value;
    },
  };
}

async function runToCompletion(input: {
  runId: number;
  fetchImpl: typeof fetch;
  clock: TestClock;
  executionToken: string;
}) {
  const registry = createScraperRegistry({ targets: [], sources: [] });
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const result = await executeScraperRun(
      { runId: input.runId },
      {
        registry,
        fetchImpl: input.fetchImpl,
        clock: input.clock,
        executionToken: `${input.executionToken}-${attempt}`,
        requestModel,
      },
    );
    if (result.status === "completed") return result;
    if (result.status !== "waiting") {
      throw new Error("The test run is already owned by another worker.");
    }
    input.clock.advanceTo(result.nextAttemptAt);
  }
  throw new Error("The test run did not finish within 100 attempts.");
}

async function setupSource(limit: number = oldRules.list.limit) {
  const [user] = await db
    .insert(users)
    .values({
      username: "repair-admin",
      email: "repair-admin@example.com",
      admin: true,
    })
    .returning();
  if (!user) throw new Error("Failed to create test user.");
  const created = await createSiteWithScrapeSource({
    name: "Repair Reviews",
    kind: "review",
    websiteUrl: "https://repair.example/archive",
    createdById: user.id,
  });
  const revision = await createScrapeSourceRevision({
    scrapeSourceId: created.source.id,
    author: "person",
    createdById: user.id,
    rules: { ...oldRules, list: { ...oldRules.list, limit } },
  });
  await db
    .update(scrapeSourceRevisions)
    .set({
      previewStatus: "passed",
      previewResult: { issues: [], pages: [] },
      previewedAt: new Date(),
    })
    .where(eq(scrapeSourceRevisions.id, revision.id));
  await activateScrapeSourceRevision({
    scrapeSourceId: created.source.id,
    revisionId: revision.id,
  });
  await db
    .update(scrapeOrigins)
    .set({
      robotsMode: "not_applicable",
      robotsRationale: "Reserved test origin has no network operator.",
    })
    .where(eq(scrapeOrigins.origin, "https://repair.example"));
  return { ...created, revision, user };
}

function sitePages() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/archive") {
      return new Response(
        '<a class="review" href="/one">One</a><a class="review" href="/legacy">Legacy</a>',
      );
    }
    if (url.pathname === "/one") {
      return new Response(
        '<h1>Current reviews</h1><time datetime="2026-09-08"></time><article class="review"><h3>Current Malt</h3><div class="body">Fresh fruit.</div></article>',
      );
    }
    if (url.pathname === "/legacy") {
      return new Response(
        '<h2 class="page-title">Legacy reviews</h2><time datetime="2026-09-07"></time><article class="review"><h3>Legacy Malt</h3><div class="body">Soft smoke.</div></article>',
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  });
}

function ruleResponse(rules: ScrapeRules) {
  return {
    model: "test-model",
    output: [
      {
        type: "function_call" as const,
        call_id: "repair-rules",
        name: "test_rules",
        arguments: JSON.stringify({
          listPageUrl: "https://repair.example/archive",
          rules,
        }),
      },
    ],
  };
}

function acceptTestedRules(rules: ScrapeRules) {
  return async (input: SetupAgentModelRequest) => {
    const last = z
      .object({ type: z.literal("function_call_output"), output: z.string() })
      .safeParse(input.input.at(-1));
    if (
      last.success &&
      z
        .object({ status: z.literal("passed") })
        .safeParse(JSON.parse(last.data.output)).success
    ) {
      return {
        model: "test-model",
        output: [
          {
            type: "function_call" as const,
            call_id: "accept-rules",
            name: "finish",
            arguments: "{}",
          },
        ],
      };
    }
    return ruleResponse(rules);
  };
}

async function startRepair() {
  const created = await setupSource();
  const collection = await createPinnedScrapeSourceRun(db, {
    externalSiteId: created.site.id,
    trigger: "scheduled",
    purpose: "collect",
  });
  const result = await runToCompletion({
    runId: collection.run.id,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "broken-collection",
  });
  if (result.nextRunId === undefined) {
    throw new Error("Failed collection did not create a repair run.");
  }
  return { ...created, repairRunId: result.nextRunId };
}

async function expectCollectionStopped(siteId: number) {
  const enqueue = vi.fn<ScraperEnqueue>();
  const lifecycle = createScraperLifecycle({
    registry: createScraperRegistry({ targets: [], sources: [] }),
    enqueue,
  });
  await expect(
    lifecycle.queueScheduledExternalSiteRun(siteId),
  ).resolves.toBeNull();
  expect(enqueue).not.toHaveBeenCalled();
}

beforeEach(() => {
  requestModel.mockReset();
});

test("repairs and activates tested rules, then collects without model calls", async () => {
  const { revision, site, source, user, repairRunId } = await startRepair();
  const fetchImpl = sitePages();
  expect(requestModel).not.toHaveBeenCalled();

  const [broken] = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.id, revision.id));
  expect(broken).toMatchObject({ previewStatus: "failed", active: true });
  const [repairRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, repairRunId));
  expect(repairRun).toMatchObject({
    status: "queued",
    purpose: "suggest",
    requestedById: null,
    requestLimit: 325,
    cursor: {
      repair: {
        revisionId: revision.id,
        pageUrl: "https://repair.example/legacy",
      },
    },
  });

  await expectCollectionStopped(site.id);
  requestModel.mockImplementation(acceptTestedRules(repairedRules));
  await expect(
    runToCompletion({
      runId: repairRunId,
      fetchImpl,
      clock: testClock(),
      executionToken: "repair-owner",
    }),
  ).resolves.toEqual({ status: "completed" });

  const revisions = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id));
  expect(revisions).toHaveLength(2);
  const repaired = revisions.find((candidate) => candidate.id !== revision.id);
  expect(repaired).toMatchObject({
    author: "ai",
    createdById: null,
    active: true,
    previewStatus: "passed",
    previewResult: {
      issues: [],
      pages: [
        { url: "https://repair.example/one" },
        { url: "https://repair.example/legacy" },
      ],
    },
  });
  expect(
    revisions.find((candidate) => candidate.id === revision.id),
  ).toMatchObject({ active: false });
  expect(requestModel).toHaveBeenCalledTimes(2);
  const firstInput = requestModel.mock.calls[0]?.[0].input[0];
  const [completedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, repairRunId));
  const completedCursor = ScrapeSourceSuggestionCursorSchema.parse(
    completedRun!.cursor,
  );
  expect(completedCursor).toMatchObject({
    modelCallCount: 2,
    repair: { revisionId: revision.id },
  });
  expect(completedCursor).not.toHaveProperty("setup");
  const { content } = z.object({ content: z.string() }).parse(firstInput);
  expect(JSON.parse(content)).toMatchObject({
    failure: {
      url: "https://repair.example/legacy",
      html: expect.stringContaining("Legacy reviews"),
      issues: expect.any(Array),
    },
    previousSetup: {
      rules: oldRules,
    },
  });

  await expect(
    runToCompletion({
      runId: repairRunId,
      fetchImpl,
      clock: testClock(),
      executionToken: "duplicate-repair",
    }),
  ).resolves.toEqual({ status: "completed" });
  expect(requestModel).toHaveBeenCalledTimes(2);

  const healthy = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "scheduled",
    purpose: "collect",
  });
  await expect(
    runToCompletion({
      runId: healthy.run.id,
      fetchImpl,
      clock: testClock(),
      executionToken: "healthy-owner",
    }),
  ).resolves.toEqual({ status: "completed" });
  expect(requestModel).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(scrapeSourceRuns)
      .where(
        and(
          eq(scrapeSourceRuns.scrapeSourceId, source.id),
          eq(scrapeSourceRuns.purpose, "suggest"),
        ),
      ),
  ).toHaveLength(1);

  // A completed collection proves recovery, even if the next break is the same day.
  const later = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    trigger: "scheduled",
    purpose: "collect",
  });
  await expect(
    runToCompletion({
      runId: later.run.id,
      fetchImpl: vi.fn<typeof fetch>(
        async () => new Response("<main>Changed page</main>"),
      ),
      clock: testClock("2026-09-09T18:00:00Z"),
      executionToken: "new-break",
    }),
  ).resolves.toMatchObject({ nextRunId: expect.any(Number) });
  expect(requestModel).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(scrapeSourceRuns)
      .where(eq(scrapeSourceRuns.purpose, "suggest")),
  ).toHaveLength(2);
});

test("does not ask the model to repair a network failure", async () => {
  const { site, user } = await setupSource();
  await db.update(scrapeTargets).set({ maxRetries: 0 });
  const collection = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    requestedById: user.id,
    trigger: "scheduled",
    purpose: "collect",
  });

  await expect(
    runToCompletion({
      runId: collection.run.id,
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new TypeError("Connection closed");
      }),
      clock: testClock(),
      executionToken: "network-failure-owner",
    }),
  ).rejects.toThrow("Scraper request failed: transport");
  expect(requestModel).not.toHaveBeenCalled();
  expect(
    await db
      .select()
      .from(scrapeSourceRuns)
      .where(eq(scrapeSourceRuns.purpose, "suggest")),
  ).toEqual([]);
});

test("a repaired version that fails collection cannot start another repair days later", async () => {
  const { site, source, repairRunId } = await startRepair();
  requestModel.mockImplementation(acceptTestedRules(repairedRules));
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "repair-owner",
  });
  const preview = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    trigger: "manual",
    purpose: "preview",
  });
  await runToCompletion({
    runId: preview.run.id,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "passing-preview",
  });
  await db.update(scrapeTargets).set({ maxRetries: 0 });
  const networkFailure = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    trigger: "scheduled",
    purpose: "collect",
  });
  await expect(
    runToCompletion({
      runId: networkFailure.run.id,
      fetchImpl: vi.fn<typeof fetch>(async () => {
        throw new TypeError("Connection closed");
      }),
      clock: testClock(),
      executionToken: "network-failure-after-repair",
    }),
  ).rejects.toThrow("Scraper request failed: transport");
  const collection = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    trigger: "scheduled",
    purpose: "collect",
  });
  await db
    .update(externalSiteRuns)
    .set({ createdAt: new Date("2026-09-15T12:00:00Z") })
    .where(eq(externalSiteRuns.id, collection.run.id));
  await expect(
    runToCompletion({
      runId: collection.run.id,
      fetchImpl: vi.fn<typeof fetch>(
        async () => new Response("<main>Changed page</main>"),
      ),
      clock: testClock("2026-09-15T12:00:00Z"),
      executionToken: "failed-repaired-version",
    }),
  ).resolves.toEqual({ status: "completed" });
  for (const runId of [repairRunId, collection.run.id]) {
    await runToCompletion({
      runId,
      fetchImpl: sitePages(),
      clock: testClock("2026-10-01T12:00:00Z"),
      executionToken: "redelivered-job",
    });
  }
  await expectCollectionStopped(site.id);
  expect(requestModel).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(scrapeSourceRuns)
      .where(eq(scrapeSourceRuns.purpose, "suggest")),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(scrapeSourceRevisions)
      .where(
        and(
          eq(scrapeSourceRevisions.scrapeSourceId, source.id),
          eq(scrapeSourceRevisions.active, true),
        ),
      ),
  ).toMatchObject([{ previewStatus: "failed" }]);
});

test("failed repair stops after three model calls and allows an explicit manual retry", async () => {
  const { site, source, user, revision, repairRunId } = await startRepair();
  requestModel.mockImplementation(acceptTestedRules(oldRules));
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "failed-repair",
  });
  expect(requestModel).toHaveBeenCalledTimes(3);
  const [failedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, repairRunId));
  expect(failedRun).toMatchObject({
    status: "failed",
    cursor: { modelCallCount: 3, repair: { revisionId: revision.id } },
  });
  expect(failedRun!.cursor).not.toHaveProperty("setup");
  expect(await db.select().from(scrapeSourceRevisions)).toMatchObject([
    { id: revision.id, active: true, previewStatus: "failed" },
  ]);
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock("2026-10-01T12:00:00Z"),
    executionToken: "redelivered-failed-repair",
  });
  await expectCollectionStopped(site.id);
  expect(requestModel).toHaveBeenCalledTimes(3);

  const manual = await createScrapeSourceSuggestionRun({
    scrapeSourceId: source.id,
    requestedById: user.id,
  });
  requestModel.mockImplementation(acceptTestedRules(repairedRules));
  await runToCompletion({
    runId: manual.id,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "manual-retry",
  });
  expect(requestModel).toHaveBeenCalledTimes(5);
  expect(
    await db
      .select()
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.author, "ai")),
  ).toMatchObject([{ active: false, previewStatus: "passed" }]);
});

test("a sampled setup preserves the collection cap and collects beyond its sample", async () => {
  const { source, site, user, revision } = await setupSource(99);
  const rules = { ...oldRules, list: { ...oldRules.list, limit: 99 } };
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/archive") {
      return new Response(
        Array.from(
          { length: 25 },
          (_, i) => `<a class="review" href="/reviews/${i}">Malt ${i}</a>`,
        ).join(""),
      );
    }
    if (url.pathname.startsWith("/reviews/")) {
      return new Response(
        `<h1>Malt ${url.pathname.split("/").at(-1)}</h1><time datetime="2026-09-08"></time><article class="review"><h3>Coastal Malt</h3><div class="body">Soft smoke.</div></article>`,
      );
    }
    throw new Error(`Unexpected URL: ${url.toString()}`);
  };
  const run = await createScrapeSourceSuggestionRun({
    scrapeSourceId: source.id,
    requestedById: user.id,
  });
  requestModel
    .mockResolvedValueOnce(
      ruleResponse({ ...rules, list: { ...rules.list, limit: 20 } }),
    )
    .mockImplementation(acceptTestedRules(rules));
  await runToCompletion({
    runId: run.id,
    fetchImpl,
    clock: testClock(),
    executionToken: "sampled-setup",
  });
  const revisions = await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id));
  const suggested = revisions.find((candidate) => candidate.author === "ai");
  expect(suggested).toMatchObject({
    active: false,
    rulesVersion: 11,
    rules,
    previewStatus: "passed",
  });
  expect(suggested!.previewResult!.pages).toHaveLength(20);
  expect(
    await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, run.id)),
  ).toMatchObject([{ status: "succeeded", requestCount: 21 }]);
  expect(
    revisions.find((candidate) => candidate.id === revision.id),
  ).toMatchObject({
    active: true,
  });

  await activateScrapeSourceRevision({
    scrapeSourceId: source.id,
    revisionId: suggested!.id,
  });
  const collection = await createPinnedScrapeSourceRun(db, {
    externalSiteId: site.id,
    trigger: "manual",
    purpose: "collect",
    requestedById: user.id,
  });
  await runToCompletion({
    runId: collection.run.id,
    fetchImpl,
    clock: testClock(),
    executionToken: "full-collection",
  });
  expect(
    await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, collection.run.id)),
  ).toMatchObject([{ status: "succeeded", emittedItemCount: 25 }]);
  // Scraper setup owns the model budget; collection must not invoke it.
  expect(requestModel).toHaveBeenCalledTimes(3);
});

test.each([
  {
    rulesVersion: 11,
    rules: { ...oldRules, list: { ...oldRules.list, limit: 100 } },
  },
  { rulesVersion: 2, rules: oldRules },
])(
  "setup can replace unreadable saved rules ($rulesVersion)",
  async (saved) => {
    const { source, revision, user } = await setupSource();
    await db
      .update(scrapeSourceRevisions)
      .set({ ...saved, previewStatus: "failed" })
      .where(eq(scrapeSourceRevisions.id, revision.id));
    const run = await createScrapeSourceSuggestionRun({
      scrapeSourceId: source.id,
      requestedById: user.id,
    });
    const replacement = {
      ...repairedRules,
      list: { ...repairedRules.list, limit: 99 },
    };
    requestModel.mockImplementation(acceptTestedRules(replacement));
    await expect(
      runToCompletion({
        runId: run.id,
        fetchImpl: sitePages(),
        clock: testClock(),
        executionToken: "invalid-saved-rules",
      }),
    ).resolves.toEqual({ status: "completed" });
    const { content } = z
      .object({ content: z.string() })
      .parse(requestModel.mock.calls[0]?.[0].input[0]);
    expect(JSON.parse(content)).toMatchObject({ previousSetup: saved });
    expect(
      await db
        .select()
        .from(externalSiteRuns)
        .where(eq(externalSiteRuns.id, run.id)),
    ).toMatchObject([
      {
        status: "succeeded",
        error: null,
      },
    ]);
    expect(await db.select().from(scrapeSourceRevisions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: revision.id, active: true, ...saved }),
        expect.objectContaining({
          rulesVersion: 11,
          active: false,
          rules: replacement,
          previewStatus: "passed",
        }),
      ]),
    );
  },
);

test("pausing while repair is running prevents automatic activation", async () => {
  const { site, source, revision, repairRunId } = await startRepair();
  requestModel.mockImplementation(async (input) => {
    await pauseScrapeSource(source.id);
    return await acceptTestedRules(repairedRules)(input);
  });
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "paused-repair",
  });
  expect(requestModel).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.active, true)),
  ).toMatchObject([{ id: revision.id }]);
  await expectCollectionStopped(site.id);
});

test("resumes a waiting rule test without spending another model call", async () => {
  const { repairRunId } = await startRepair();
  requestModel.mockImplementation(acceptTestedRules(repairedRules));
  const pages = sitePages();
  let blocked = false;
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/archive") {
      return new Response(
        '<a class="review" href="/one">One</a><a class="review" href="/legacy">Two</a><a class="review" href="/third">Three</a><a class="review" href="/blocked">Four</a>',
      );
    }
    if (url.pathname === "/third") return pages("https://repair.example/one");
    if (url.pathname === "/blocked" && !blocked) {
      blocked = true;
      return new Response(null, {
        status: 429,
        headers: { "retry-after": "60" },
      });
    }
    if (url.pathname === "/blocked") return pages("https://repair.example/one");
    return pages(input, init);
  });

  await runToCompletion({
    runId: repairRunId,
    fetchImpl,
    clock: testClock(),
    executionToken: "waiting-repair",
  });

  expect(requestModel).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, repairRunId)),
  ).toMatchObject([
    {
      status: "succeeded",
      cursor: { modelCallCount: 2 },
      error: null,
    },
  ]);
  expect(
    await db
      .select()
      .from(scrapeSourceRuns)
      .where(eq(scrapeSourceRuns.purpose, "suggest")),
  ).toHaveLength(1);
  expect(blocked).toBe(true);
});

test("keeps the model budget across executions and does not restart an exhausted repair", async () => {
  const { site, revision, repairRunId } = await startRepair();
  const [run] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, repairRunId));
  await db
    .update(externalSiteRuns)
    .set({
      cursor: {
        ...ScrapeSourceSuggestionCursorSchema.parse(run!.cursor),
        modelCallCount: 7,
      },
    })
    .where(eq(externalSiteRuns.id, repairRunId));
  requestModel.mockResolvedValue({
    model: "test-model",
    output: [
      {
        type: "function_call",
        call_id: "untested",
        name: "finish",
        arguments: "{}",
      },
    ],
  });
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "last-turn",
  });
  expect(requestModel).toHaveBeenCalledTimes(1);
  expect(
    await db
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, repairRunId)),
  ).toMatchObject([{ status: "failed", cursor: { modelCallCount: 8 } }]);
  await runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock: testClock(),
    executionToken: "duplicate-exhausted",
  });
  expect(requestModel).toHaveBeenCalledTimes(1);
  expect(await db.select().from(scrapeSourceRevisions)).toMatchObject([
    { id: revision.id },
  ]);
  await expectCollectionStopped(site.id);
});

test("a page tool cannot fetch outside the source website", async () => {
  const { repairRunId } = await startRepair();
  requestModel
    .mockResolvedValueOnce({
      model: "test-model",
      output: [
        {
          type: "function_call",
          call_id: "offsite",
          name: "read_page",
          arguments: JSON.stringify({
            url: "https://unrelated.example/private",
          }),
        },
      ],
    })
    .mockImplementation(acceptTestedRules(repairedRules));
  const fetchImpl = sitePages();
  await runToCompletion({
    runId: repairRunId,
    fetchImpl,
    clock: testClock(),
    executionToken: "scoped-page-read",
  });
  expect(JSON.stringify(requestModel.mock.calls[1]?.[0].input)).toContain(
    "allowed website",
  );
  expect(
    fetchImpl.mock.calls.some(
      ([url]) =>
        new URL(url instanceof Request ? url.url : url).hostname ===
        "unrelated.example",
    ),
  ).toBe(false);
  expect(
    await db
      .select()
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.author, "ai")),
  ).toMatchObject([{ active: true }]);
});

test("duplicate delivery while the model is running cannot start another repair", async () => {
  const { repairRunId } = await startRepair();
  const enteredModel = Promise.withResolvers<void>();
  const finishModel = Promise.withResolvers<void>();
  requestModel.mockImplementation(async (input) => {
    enteredModel.resolve();
    await finishModel.promise;
    return await acceptTestedRules(repairedRules)(input);
  });
  const clock = testClock();
  const running = runToCompletion({
    runId: repairRunId,
    fetchImpl: sitePages(),
    clock,
    executionToken: "first-worker",
  });
  await enteredModel.promise;
  try {
    await expect(
      executeScraperRun(
        { runId: repairRunId },
        {
          registry: createScraperRegistry({ targets: [], sources: [] }),
          fetchImpl: sitePages(),
          clock,
          executionToken: "duplicate-worker",
          requestModel,
        },
      ),
    ).resolves.toEqual({ status: "duplicate" });
    expect(requestModel).toHaveBeenCalledTimes(1);
  } finally {
    finishModel.resolve();
    await running;
  }
  expect(
    await db
      .select()
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.author, "ai")),
  ).toMatchObject([{ active: true, previewStatus: "passed" }]);
});
