import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  scrapeOrigins,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import type { ScraperHttpClock } from "./http";
import {
  ensureRobotsAllowed as ensureRobotsAllowedImpl,
  parseRobotsRules,
  robotsAllowsUrl,
  ScraperRobotsDeniedError,
} from "./robots";
import { syncScraperDefinitions } from "./syncDefinitions";

const adapter = async () => {};
const sink = async () => {};
const EXECUTION_TOKEN = "owner";

function ensureRobotsAllowed(
  input: Omit<Parameters<typeof ensureRobotsAllowedImpl>[0], "executionToken">,
) {
  return ensureRobotsAllowedImpl({ ...input, executionToken: EXECUTION_TOKEN });
}

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

async function setupRobotsRuntime({
  mode = "enforce",
  maxRetries = 0,
  targetEnabled = true,
}: {
  mode?: "enforce" | "not_applicable";
  maxRetries?: number;
  targetEnabled?: boolean;
} = {}) {
  const robots =
    mode === "enforce"
      ? ({ mode } as const)
      : ({
          mode,
          rationale: "Provider documents this as a public catalog API.",
        } as const);
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        enabled: targetEnabled,
        maxRetries,
        origins: [{ origin: "https://example.com", robots }],
      }),
    ],
    sources: [
      defineScraperSource({
        key: "finedrams",
        externalSiteType: "finedrams",
        targetKeys: ["operator"],
        cursorSchema: z.null(),
        observationSchema: z.string(),
        adapter,
        sink,
      }),
    ],
  });
  const [site] = await db
    .insert(externalSites)
    .values({ type: "finedrams", name: "Fine Drams" })
    .returning();
  if (!site) throw new Error("Expected site.");
  await syncScraperDefinitions(registry);
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      status: "running",
      executionToken: EXECUTION_TOKEN,
      executionExpiresAt: new Date("2026-08-19T12:00:00Z"),
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  return { registry, run };
}

test("parses user-agent groups and applies longest-match allow precedence", () => {
  const state = parseRobotsRules(`
    User-agent: *
    Disallow: /private

    User-agent: PeatedBot
    Disallow: /catalog
    Allow: /catalog/public
    Disallow: /*.pdf$
  `);

  expect(robotsAllowsUrl(state, new URL("https://example.com/catalog/a"))).toBe(
    false,
  );
  expect(
    robotsAllowsUrl(state, new URL("https://example.com/catalog/public/a")),
  ).toBe(true);
  expect(robotsAllowsUrl(state, new URL("https://example.com/file.pdf"))).toBe(
    false,
  );
  // The specific PeatedBot group replaces the wildcard group.
  expect(robotsAllowsUrl(state, new URL("https://example.com/private"))).toBe(
    true,
  );
});

test("uses a fresh SQL cache and refuses a disallowed path without contact", async () => {
  const { registry, run } = await setupRobotsRuntime();
  const now = new Date("2026-08-18T12:00:00Z");
  await db
    .update(scrapeOrigins)
    .set({
      robotsState: parseRobotsRules("User-agent: *\nDisallow: /private"),
      robotsFetchedAt: now,
      robotsExpiresAt: new Date("2026-08-19T12:00:00Z"),
    })
    .where(eq(scrapeOrigins.origin, "https://example.com"));
  const fetchImpl = vi.fn<typeof fetch>();

  await expect(
    ensureRobotsAllowed({
      runId: run.id,
      sourceKey: "finedrams",
      targetKey: "operator",
      url: new URL("https://example.com/private/article"),
      registry,
      fetchImpl,
      clock: fixedClock(),
    }),
  ).rejects.toBeInstanceOf(ScraperRobotsDeniedError);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("caches a missing robots document as allowed for the bounded period", async () => {
  const { registry, run } = await setupRobotsRuntime();
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 404 }));
  const input = {
    runId: run.id,
    sourceKey: "finedrams",
    targetKey: "operator",
    url: new URL("https://example.com/catalog"),
    registry,
    fetchImpl,
    clock: fixedClock(),
  } as const;

  await expect(ensureRobotsAllowed(input)).resolves.toBeUndefined();
  await expect(ensureRobotsAllowed(input)).resolves.toBeUndefined();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [origin] = await db
    .select()
    .from(scrapeOrigins)
    .where(eq(scrapeOrigins.origin, "https://example.com"));
  expect(origin?.robotsState).toEqual({ status: "missing" });
  const [runState] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(runState?.requestCount).toBe(1);
});

test("defers when robots is unavailable without a fresh decision", async () => {
  const { registry, run } = await setupRobotsRuntime();
  await expect(
    ensureRobotsAllowed({
      runId: run.id,
      sourceKey: "finedrams",
      targetKey: "operator",
      url: new URL("https://example.com/catalog"),
      registry,
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      clock: fixedClock(),
    }),
  ).rejects.toMatchObject({
    reason: "robots_unavailable",
    nextEligibleAt: new Date("2026-08-18T12:15:00Z"),
  });
  const [origin] = await db.select().from(scrapeOrigins);
  expect(origin?.robotsState).toBeNull();
});

test("does not report a disabled target as unavailable robots", async () => {
  const { registry, run } = await setupRobotsRuntime({
    targetEnabled: false,
  });
  const fetchImpl = vi.fn<typeof fetch>();

  await expect(
    ensureRobotsAllowed({
      runId: run.id,
      sourceKey: "finedrams",
      targetKey: "operator",
      url: new URL("https://example.com/catalog"),
      registry,
      fetchImpl,
      clock: fixedClock(),
    }),
  ).rejects.toMatchObject({
    category: "invalid_request",
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("refreshes expired rules and persists parsed rules rather than content", async () => {
  const { registry, run } = await setupRobotsRuntime();
  await db
    .update(scrapeOrigins)
    .set({
      robotsState: { status: "missing" },
      robotsFetchedAt: new Date("2026-08-16T12:00:00Z"),
      robotsExpiresAt: new Date("2026-08-17T12:00:00Z"),
    })
    .where(eq(scrapeOrigins.origin, "https://example.com"));

  await expect(
    ensureRobotsAllowed({
      runId: run.id,
      sourceKey: "finedrams",
      targetKey: "operator",
      url: new URL("https://example.com/private"),
      registry,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("User-agent: *\nDisallow: /private\n# not retained"),
        ),
      clock: fixedClock(),
    }),
  ).rejects.toBeInstanceOf(ScraperRobotsDeniedError);
  const [origin] = await db.select().from(scrapeOrigins);
  expect(origin?.robotsState).toEqual({
    status: "rules",
    groups: [
      {
        userAgents: ["*"],
        rules: [{ directive: "disallow", path: "/private" }],
      },
    ],
  });
  expect(JSON.stringify(origin)).not.toContain("not retained");
});

test("skips robots only for a reviewed non-crawler API definition", async () => {
  const { registry, run } = await setupRobotsRuntime({
    mode: "not_applicable",
  });
  const fetchImpl = vi.fn<typeof fetch>();
  await expect(
    ensureRobotsAllowed({
      runId: run.id,
      sourceKey: "finedrams",
      targetKey: "operator",
      url: new URL("https://example.com/catalog"),
      registry,
      fetchImpl,
      clock: fixedClock(),
    }),
  ).resolves.toBeUndefined();
  expect(fetchImpl).not.toHaveBeenCalled();
});
