import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import type { ScraperHttpClock } from "./http";
import { ScraperRobotsDeniedError } from "./robots";
import { createScraperSession } from "./session";
import { syncScraperDefinitions } from "./syncDefinitions";

const adapter = async () => {};
const sink = async () => {};
const EXECUTION_TOKEN = "owner";

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
        externalSiteKey: "finedrams",
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
  const source = registry.sources.get("finedrams");
  if (!source) throw new Error("Expected source.");
  return { registry, run, source };
}

/** A fake network keyed by URL; anything else is a test failure. */
function network(routes: Record<string, () => Response>) {
  return vi.fn<typeof fetch>(async (input) => {
    const href = input instanceof Request ? input.url : input.toString();
    const route = routes[href];
    if (!route) throw new Error(`Unexpected request: ${href}`);
    return route();
  });
}

function requested(fetchImpl: ReturnType<typeof network>) {
  return fetchImpl.mock.calls.map(([input]) =>
    input instanceof Request ? input.url : input.toString(),
  );
}

async function runRequestCount(runId: number) {
  const [run] = await db
    .select({ requestCount: externalSiteRuns.requestCount })
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, runId));
  return run?.requestCount;
}

test("refuses a path robots.txt disallows without contacting it", async () => {
  const { registry, run, source } = await setupRobotsRuntime();
  const fetchImpl = network({
    "https://example.com/robots.txt": () =>
      new Response("User-agent: *\nDisallow: /private"),
    "https://example.com/public": () => new Response("ok"),
  });
  const session = createScraperSession({
    run,
    source,
    registry,
    executionToken: EXECUTION_TOKEN,
    fetchImpl,
    clock: fixedClock(),
  });

  await expect(
    session.request({
      target: "operator",
      url: new URL("https://example.com/private/article"),
    }),
  ).rejects.toBeInstanceOf(ScraperRobotsDeniedError);
  await session.request({
    target: "operator",
    url: new URL("https://example.com/public"),
  });

  // Robots.txt is read once and shared; only the page counts toward the run.
  expect(requested(fetchImpl)).toEqual([
    "https://example.com/robots.txt",
    "https://example.com/public",
  ]);
  expect(await runRequestCount(run.id)).toBe(1);
});

test("checks robots.txt again before following a redirect", async () => {
  const { registry, run, source } = await setupRobotsRuntime();
  const fetchImpl = network({
    "https://example.com/robots.txt": () =>
      new Response("User-agent: *\nDisallow: /private"),
    "https://example.com/public/article": () =>
      new Response(null, {
        status: 302,
        headers: { location: "/private/article" },
      }),
  });
  const session = createScraperSession({
    run,
    source,
    registry,
    executionToken: EXECUTION_TOKEN,
    fetchImpl,
    clock: fixedClock(),
  });

  await expect(
    session.request({
      target: "operator",
      url: new URL("https://example.com/public/article"),
    }),
  ).rejects.toBeInstanceOf(ScraperRobotsDeniedError);
  expect(requested(fetchImpl)).not.toContain(
    "https://example.com/private/article",
  );
});

test("waits when robots.txt can't be read", async () => {
  const { registry, run, source } = await setupRobotsRuntime();
  const fetchImpl = network({
    "https://example.com/robots.txt": () => new Response("", { status: 503 }),
  });
  const session = createScraperSession({
    run,
    source,
    registry,
    executionToken: EXECUTION_TOKEN,
    fetchImpl,
    clock: fixedClock(),
  });

  await expect(
    session.request({
      target: "operator",
      url: new URL("https://example.com/catalog"),
    }),
  ).rejects.toMatchObject({
    reason: "robots_unavailable",
    nextEligibleAt: new Date("2026-08-18T12:15:00Z"),
  });
  expect(requested(fetchImpl)).toEqual(["https://example.com/robots.txt"]);
});

test("does not report a disabled target as unavailable robots", async () => {
  const { registry, run, source } = await setupRobotsRuntime({
    targetEnabled: false,
  });
  const fetchImpl = network({});
  const session = createScraperSession({
    run,
    source,
    registry,
    executionToken: EXECUTION_TOKEN,
    fetchImpl,
    clock: fixedClock(),
  });

  await expect(
    session.request({
      target: "operator",
      url: new URL("https://example.com/catalog"),
    }),
  ).rejects.toMatchObject({ category: "invalid_request" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("skips robots.txt only for a reviewed non-crawler API definition", async () => {
  const { registry, run, source } = await setupRobotsRuntime({
    mode: "not_applicable",
  });
  const fetchImpl = network({
    "https://example.com/catalog": () => new Response("[]"),
  });
  const session = createScraperSession({
    run,
    source,
    registry,
    executionToken: EXECUTION_TOKEN,
    fetchImpl,
    clock: fixedClock(),
  });

  await session.request({
    target: "operator",
    url: new URL("https://example.com/catalog"),
  });
  expect(requested(fetchImpl)).toEqual(["https://example.com/catalog"]);
});
