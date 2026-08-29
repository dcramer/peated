import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  acquireScrapePermit as acquireScrapePermitImpl,
  type CoordinatorDatabase,
  recordScrapeRateLimit,
  releaseScrapePermit,
  ScraperCoordinationError,
} from "./coordinator";

const EXECUTION_TOKEN = "owner";

function acquireScrapePermit(
  input: Omit<Parameters<typeof acquireScrapePermitImpl>[0], "executionToken">,
) {
  return acquireScrapePermitImpl({ ...input, executionToken: EXECUTION_TOKEN });
}

const baseTarget = {
  key: "operator",
  enabled: true,
  minimumSpacingMs: 2_000,
  requestsPerWindow: 300,
  windowMs: 3_600_000,
  timeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetries: 2,
};

async function createRun({
  siteKey = "finedrams",
  requestLimit = 100,
  mapTarget = true,
}: {
  siteKey?: "finedrams" | "whiskyworld";
  requestLimit?: number;
  mapTarget?: boolean;
} = {}) {
  const [site] = await db
    .insert(externalSites)
    .values({ type: siteKey, name: siteKey })
    .returning();
  if (!site) throw new Error("Expected site.");
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      status: "running",
      requestLimit,
      executionToken: EXECUTION_TOKEN,
      executionExpiresAt: new Date("2026-08-19T12:00:00Z"),
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  if (mapTarget) {
    await db.insert(externalSiteScrapeTargets).values({
      externalSiteId: site.id,
      targetKey: baseTarget.key,
    });
  }
  return run;
}

test("grants one bounded permit and accounts for a retry atomically", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const run = await createRun({ requestLimit: 3 });
  const now = new Date("2026-08-18T12:00:00Z");

  const permit = await acquireScrapePermit({
    runId: run.id,
    targetKey: baseTarget.key,
    isRetry: true,
    now,
    token: "permit-1",
  });

  expect(permit).toEqual({
    granted: true,
    token: "permit-1",
    targetKey: baseTarget.key,
    timeoutMs: 30_000,
    maxResponseBytes: 10 * 1024 * 1024,
    maxRetries: 2,
    remainingRequests: 2,
  });
  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun).toMatchObject({ requestCount: 1, retryCount: 1 });
});

test("serializes competing workers and releases only the matching lease", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const firstRun = await createRun();
  const secondRun = await createRun({ siteKey: "whiskyworld" });
  const now = new Date("2026-08-18T12:00:00Z");

  const [first, second] = await Promise.all([
    acquireScrapePermit({
      runId: firstRun.id,
      targetKey: baseTarget.key,
      now,
      token: "first",
    }),
    acquireScrapePermit({
      runId: secondRun.id,
      targetKey: baseTarget.key,
      now,
      token: "second",
    }),
  ]);
  expect([first, second].filter((result) => result.granted)).toHaveLength(1);
  expect([first, second].find((result) => !result.granted)).toMatchObject({
    granted: false,
    reason: "target_busy",
  });

  const granted = first.granted ? first : second;
  expect(granted.granted).toBe(true);
  if (!granted.granted) throw new Error("Expected granted permit.");
  expect(
    await releaseScrapePermit({
      targetKey: baseTarget.key,
      token: "stale-token",
      now,
    }),
  ).toBe(false);
  expect(
    await releaseScrapePermit({
      targetKey: baseTarget.key,
      token: granted.token,
      now,
    }),
  ).toBe(true);
});

test("refuses permits from a stale run execution", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const run = await createRun();

  await expect(
    acquireScrapePermitImpl({
      runId: run.id,
      executionToken: "stale-owner",
      targetKey: baseTarget.key,
      now: new Date("2026-08-18T12:00:00Z"),
    }),
  ).resolves.toMatchObject({ granted: false, reason: "run_inactive" });

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun?.requestCount).toBe(0);
});

test("expires crashed leases without allowing stale release to clear a successor", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const run = await createRun();
  const firstAt = new Date("2026-08-18T12:00:00Z");
  const first = await acquireScrapePermit({
    runId: run.id,
    targetKey: baseTarget.key,
    now: firstAt,
    token: "expired",
  });
  expect(first.granted).toBe(true);

  const secondAt = new Date("2026-08-18T12:00:36Z");
  const second = await acquireScrapePermit({
    runId: run.id,
    targetKey: baseTarget.key,
    now: secondAt,
    token: "successor",
  });
  expect(second.granted).toBe(true);
  expect(
    await releaseScrapePermit({
      targetKey: baseTarget.key,
      token: "expired",
      now: secondAt,
    }),
  ).toBe(false);

  const [target] = await db
    .select()
    .from(scrapeTargets)
    .where(eq(scrapeTargets.key, baseTarget.key));
  expect(target?.leaseToken).toBe("successor");
});

test("enforces spacing, fixed-window quota, and the run budget", async () => {
  await db.insert(scrapeTargets).values({
    ...baseTarget,
    minimumSpacingMs: 1_000,
    requestsPerWindow: 2,
  });
  const run = await createRun({ requestLimit: 2 });
  const startedAt = new Date("2026-08-18T12:00:00Z");
  const first = await acquireScrapePermit({
    runId: run.id,
    targetKey: baseTarget.key,
    now: startedAt,
    token: "first",
  });
  if (!first.granted) throw new Error("Expected first permit.");
  await releaseScrapePermit({
    targetKey: baseTarget.key,
    token: first.token,
    now: startedAt,
  });

  expect(
    await acquireScrapePermit({
      runId: run.id,
      targetKey: baseTarget.key,
      now: new Date("2026-08-18T12:00:00.500Z"),
    }),
  ).toMatchObject({ granted: false, reason: "target_spacing" });

  const secondAt = new Date("2026-08-18T12:00:01Z");
  const second = await acquireScrapePermit({
    runId: run.id,
    targetKey: baseTarget.key,
    now: secondAt,
    token: "second",
  });
  if (!second.granted) throw new Error("Expected second permit.");
  await releaseScrapePermit({
    targetKey: baseTarget.key,
    token: second.token,
    now: secondAt,
  });
  const otherRun = await createRun({ siteKey: "whiskyworld" });
  expect(
    await acquireScrapePermit({
      runId: otherRun.id,
      targetKey: baseTarget.key,
      now: new Date("2026-08-18T12:00:02Z"),
    }),
  ).toMatchObject({ granted: false, reason: "target_quota" });
  expect(
    await acquireScrapePermit({
      runId: run.id,
      targetKey: baseTarget.key,
      now: new Date("2026-08-18T12:00:02Z"),
    }),
  ).toMatchObject({ granted: false, reason: "run_budget" });
});

test("shares server-directed cooldowns across source runs", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const firstRun = await createRun();
  const secondRun = await createRun({ siteKey: "whiskyworld" });
  const now = new Date("2026-08-18T12:00:00Z");
  const permit = await acquireScrapePermit({
    runId: firstRun.id,
    targetKey: baseTarget.key,
    now,
    token: "limited",
  });
  if (!permit.granted) throw new Error("Expected permit.");
  const retryAt = new Date("2026-08-18T12:05:00Z");

  expect(
    await recordScrapeRateLimit({
      runId: firstRun.id,
      targetKey: baseTarget.key,
      token: permit.token,
      retryAt,
      now,
    }),
  ).toEqual(retryAt);
  expect(
    await acquireScrapePermit({
      runId: secondRun.id,
      targetKey: baseTarget.key,
      now: new Date("2026-08-18T12:01:00Z"),
    }),
  ).toEqual({
    granted: false,
    reason: "target_cooldown",
    nextEligibleAt: retryAt,
  });
  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, firstRun.id));
  expect(storedRun?.rateLimitCount).toBe(1);
});

test("fails closed for undeclared targets and coordination errors", async () => {
  await db.insert(scrapeTargets).values(baseTarget);
  const run = await createRun({ mapTarget: false });
  expect(
    await acquireScrapePermit({
      runId: run.id,
      targetKey: baseTarget.key,
    }),
  ).toMatchObject({ granted: false, reason: "target_not_allowed" });

  const failedDatabase = {
    transaction: async () => {
      throw new Error("database unavailable");
    },
  } satisfies CoordinatorDatabase;
  await expect(
    acquireScrapePermit({
      runId: run.id,
      targetKey: baseTarget.key,
      database: failedDatabase,
    }),
  ).rejects.toBeInstanceOf(ScraperCoordinationError);
});
