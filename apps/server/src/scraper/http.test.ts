import { BOT_USER_AGENT } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  scrapeTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { z } from "zod";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import {
  parseRetryAfter,
  requestScraperUrl as requestScraperUrlImpl,
  ScraperRequestError,
  type ScraperHttpClock,
  type ScraperHttpStatusError,
  type ScraperRequestDeferredError,
} from "./http";
import { syncScraperDefinitions } from "./syncDefinitions";

const adapter = async () => {};
const sink = async () => {};
const EXECUTION_TOKEN = "owner";

function requestScraperUrl(
  input: Omit<Parameters<typeof requestScraperUrlImpl>[0], "executionToken">,
) {
  return requestScraperUrlImpl({ ...input, executionToken: EXECUTION_TOKEN });
}

function clockAt(value = "2026-08-18T12:00:00Z") {
  let now = new Date(value);
  const clock: ScraperHttpClock = {
    now: () => now,
    sleep: vi.fn(async (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    }),
    random: () => 0,
  };
  return clock;
}

async function setupRuntime({
  origins = ["https://example.com"],
  requestLimit = 20,
  maxRetries = 2,
  maxResponseBytes = 10 * 1024 * 1024,
  allowedRequestHeaders = [],
}: {
  origins?: [string, ...string[]];
  requestLimit?: number;
  maxRetries?: number;
  maxResponseBytes?: number;
  allowedRequestHeaders?: string[];
} = {}) {
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        maxRetries,
        maxResponseBytes,
        allowedRequestHeaders,
        origins: origins.map((origin) => ({
          origin,
          robots: { mode: "enforce" as const },
        })) as [
          { origin: string; robots: { mode: "enforce" } },
          ...Array<{ origin: string; robots: { mode: "enforce" } }>,
        ],
      }),
    ],
    sources: [
      defineScraperSource({
        key: "finedrams",
        externalSiteType: "finedrams",
        targetKeys: ["operator"],
        requestLimit,
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
      requestLimit,
      executionToken: EXECUTION_TOKEN,
      executionExpiresAt: new Date("2026-08-19T12:00:00Z"),
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  return { registry, run };
}

test("sends an identified bounded GET and exposes only safe response headers", async () => {
  const { registry, run } = await setupRuntime();
  const fetchImpl = vi.fn(
    async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      expect(new Headers(init?.headers).get("user-agent")).toBe(BOT_USER_AGENT);
      expect(init).toMatchObject({ method: "GET", redirect: "manual" });
      return new Response("catalog", {
        headers: {
          "content-type": "text/plain",
          "set-cookie": "secret=value",
          "x-provider-debug": "private detail",
        },
      });
    },
  ) as typeof fetch;

  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/catalog"),
      },
      registry,
      fetchImpl,
      clock: clockAt(),
    }),
  ).resolves.toEqual({
    url: new URL("https://example.com/catalog"),
    status: 200,
    headers: { "content-type": "text/plain" },
    body: "catalog",
  });
  const [runState] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(runState).toMatchObject({ requestCount: 1, retryCount: 0 });
  expect((await db.select().from(scrapeTargets))[0]?.leaseToken).toBeNull();
});

test("sends code-authorized POST queries without implicit retries", async () => {
  const { registry, run } = await setupRuntime({
    allowedRequestHeaders: ["x-catalog-key"],
  });
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    expect(init).toMatchObject({
      method: "POST",
      body: '{"page":1}',
      redirect: "manual",
    });
    expect(new Headers(init?.headers).get("x-catalog-key")).toBe("public-key");
    return new Response(null, { status: 503 });
  });

  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/query"),
        method: "POST",
        body: '{"page":1}',
        headers: { "x-catalog-key": "public-key" },
      },
      registry,
      fetchImpl,
      clock: clockAt(),
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetchImpl).toHaveBeenCalledOnce();
});

test("follows declared redirects and rejects an undeclared redirect before contact", async () => {
  const { registry, run } = await setupRuntime({
    origins: ["https://example.com", "https://static.example.com"],
  });
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://static.example.com/catalog" },
      }),
    )
    .mockResolvedValueOnce(new Response("ok"));

  const response = await requestScraperUrl({
    runId: run.id,
    sourceKey: "finedrams",
    request: {
      target: "operator",
      url: new URL("https://example.com/start"),
    },
    registry,
    fetchImpl,
    clock: clockAt(),
  });
  expect(response.url.origin).toBe("https://static.example.com");
  expect(fetchImpl).toHaveBeenCalledTimes(2);

  const [secondRun] = await db
    .update(externalSiteRuns)
    .set({ requestCount: 0 })
    .where(eq(externalSiteRuns.id, run.id))
    .returning();
  if (!secondRun) throw new Error("Expected run.");
  await db
    .update(scrapeTargets)
    .set({ nextRequestAt: null, windowRequestCount: 0 })
    .where(eq(scrapeTargets.key, "operator"));
  const unsafeFetch = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "https://undeclared.example/path" },
    }),
  );
  await expect(
    requestScraperUrl({
      runId: secondRun.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/start"),
      },
      registry,
      fetchImpl: unsafeFetch,
      clock: clockAt(),
    }),
  ).rejects.toThrow(/not declared/);
  expect(unsafeFetch).toHaveBeenCalledTimes(1);
});

test("retries only transient failures and reacquires a permit", async () => {
  const { registry, run } = await setupRuntime();
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response("recovered"));

  const result = await requestScraperUrl({
    runId: run.id,
    sourceKey: "finedrams",
    request: {
      target: "operator",
      url: new URL("https://example.com/catalog"),
    },
    registry,
    fetchImpl,
    clock: clockAt(),
  });
  expect(result.body).toBe("recovered");
  const [runState] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(runState).toMatchObject({ requestCount: 2, retryCount: 1 });

  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/missing"),
      },
      registry,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("private provider message", {
          status: 404,
          headers: { "x-provider-debug": "secret" },
        }),
      ),
      clock: clockAt("2026-08-18T13:00:00Z"),
    }),
  ).rejects.toMatchObject({
    status: 404,
    headers: {},
  } satisfies Partial<ScraperHttpStatusError>);
});

test("honors Retry-After as a shared durable deferral", async () => {
  const { registry, run } = await setupRuntime();
  const clock = clockAt();
  const request = requestScraperUrl({
    runId: run.id,
    sourceKey: "finedrams",
    request: {
      target: "operator",
      url: new URL("https://example.com/catalog"),
    },
    registry,
    fetchImpl: vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 429, headers: { "retry-after": "120" } }),
      ),
    clock,
  });
  await expect(request).rejects.toEqual(
    expect.objectContaining({
      reason: "rate_limited",
      nextEligibleAt: new Date("2026-08-18T12:02:00Z"),
    }) as ScraperRequestDeferredError,
  );
  const [target] = await db.select().from(scrapeTargets);
  expect(target).toMatchObject({
    blockedUntil: new Date("2026-08-18T12:02:00Z"),
    rateLimitStreak: 1,
  });
});

test("bounds response bytes from headers and streamed content", async () => {
  const { registry, run } = await setupRuntime({ maxResponseBytes: 4 });
  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/catalog"),
      },
      registry,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("oversized", { headers: { "content-length": "9" } }),
        ),
      clock: clockAt(),
    }),
  ).rejects.toMatchObject({ category: "response_too_large" });

  await db
    .update(scrapeTargets)
    .set({ nextRequestAt: null })
    .where(eq(scrapeTargets.key, "operator"));
  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/stream"),
      },
      registry,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4, 5]))),
      clock: clockAt(),
    }),
  ).rejects.toMatchObject({ category: "response_too_large" });
});

test("classifies bounded timeout retries and rejects unsafe headers before contact", async () => {
  const { registry, run } = await setupRuntime();
  const timeoutFetch = vi
    .fn<typeof fetch>()
    .mockRejectedValue(
      new DOMException("provider detail must not escape", "TimeoutError"),
    );
  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/catalog"),
      },
      registry,
      fetchImpl: timeoutFetch,
      clock: clockAt(),
    }),
  ).rejects.toEqual(expect.objectContaining({ category: "timeout" }));
  expect(timeoutFetch).toHaveBeenCalledTimes(3);

  const neverFetch = vi.fn<typeof fetch>();
  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/catalog"),
        headers: { Authorization: "Bearer secret" },
      },
      registry,
      fetchImpl: neverFetch,
      clock: clockAt(),
    }),
  ).rejects.toBeInstanceOf(ScraperRequestError);
  expect(neverFetch).not.toHaveBeenCalled();
});

test("defers a retryable transport failure when the run budget is exhausted", async () => {
  const { registry, run } = await setupRuntime({ requestLimit: 1 });
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new DOMException("timed out", "TimeoutError"));

  await expect(
    requestScraperUrl({
      runId: run.id,
      sourceKey: "finedrams",
      request: {
        target: "operator",
        url: new URL("https://example.com/catalog"),
      },
      registry,
      fetchImpl,
      clock: clockAt(),
    }),
  ).rejects.toEqual(
    expect.objectContaining({
      reason: "run_budget",
      nextEligibleAt: null,
    }) as ScraperRequestDeferredError,
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("parses delta-seconds and HTTP-date Retry-After values", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  expect(parseRetryAfter("30", now)).toEqual(new Date("2026-08-18T12:00:30Z"));
  expect(parseRetryAfter("Tue, 18 Aug 2026 12:05:00 GMT", now)).toEqual(
    new Date("2026-08-18T12:05:00Z"),
  );
  expect(parseRetryAfter("invalid", now)).toBeNull();
  expect(parseRetryAfter("Tue, 18 Aug 2026 11:00:00 GMT", now)).toBeNull();
});
