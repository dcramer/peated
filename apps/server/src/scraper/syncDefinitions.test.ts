import { db } from "@peated/server/db";
import {
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import { syncScraperDefinitions } from "./syncDefinitions";

const adapter = async () => {};
const sink = async () => {};

function source(
  key: "finedrams" | "whiskyworld",
  targetKeys: [string, ...string[]],
) {
  return defineScraperSource({
    key,
    externalSiteKey: key,
    targetKeys,
    cursorSchema: z.null(),
    observationSchema: z.string(),
    adapter,
    sink,
  });
}

test("synchronizes definitions idempotently without resetting dynamic state", async () => {
  await db.insert(externalSites).values([
    { type: "finedrams", name: "Fine Drams" },
    { type: "whiskyworld", name: "Whisky World" },
  ]);
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        origins: [
          { origin: "https://example.com", robots: { mode: "enforce" } },
          {
            origin: "https://api.example.com",
            robots: {
              mode: "not_applicable",
              rationale: "Provider documents this as a public catalog API.",
            },
          },
        ],
      }),
    ],
    sources: [
      source("finedrams", ["operator"]),
      source("whiskyworld", ["operator"]),
    ],
  });

  await syncScraperDefinitions(registry);
  const nextRequestAt = new Date("2026-08-20T00:00:00Z");
  await db
    .update(scrapeTargets)
    .set({ nextRequestAt, windowRequestCount: 7 })
    .where(eq(scrapeTargets.key, "operator"));
  await syncScraperDefinitions(registry);

  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({
      key: "operator",
      enabled: true,
      nextRequestAt,
      windowRequestCount: 7,
    }),
  ]);
  expect(await db.select().from(scrapeOrigins)).toHaveLength(2);
  expect(await db.select().from(externalSiteScrapeTargets)).toHaveLength(2);
});

test("deactivates removed definitions without deleting their state", async () => {
  const [site] = await db
    .insert(externalSites)
    .values({ type: "finedrams", name: "Fine Drams" })
    .returning();
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        origins: [
          { origin: "https://example.com", robots: { mode: "enforce" } },
        ],
      }),
    ],
    sources: [source("finedrams", ["operator"])],
  });
  await syncScraperDefinitions(registry);
  await syncScraperDefinitions(
    createScraperRegistry({ targets: [], sources: [] }),
  );

  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({ key: "operator", enabled: false }),
  ]);
  expect(await db.select().from(scrapeOrigins)).toEqual([
    expect.objectContaining({ origin: "https://example.com", active: false }),
  ]);
  expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
    expect.objectContaining({ externalSiteId: site?.id, active: false }),
  ]);
});

test("preserves admin-owned targets, origins, and site mappings", async () => {
  const [site] = await db
    .insert(externalSites)
    .values({ type: "admin-source", name: "Admin Source" })
    .returning();
  if (!site) throw new Error("Failed to create test site.");

  await db.insert(scrapeTargets).values({
    key: "admin-source",
    owner: "admin",
    enabled: true,
    minimumSpacingMs: 2_000,
    requestsPerWindow: 60,
    windowMs: 3_600_000,
    timeoutMs: 30_000,
    maxResponseBytes: 10 * 1024 * 1024,
    maxRetries: 2,
  });
  await db.insert(scrapeOrigins).values({
    origin: "https://admin-source.test",
    owner: "admin",
    targetKey: "admin-source",
    robotsMode: "enforce",
  });
  await db.insert(externalSiteScrapeTargets).values({
    externalSiteId: site.id,
    targetKey: "admin-source",
    owner: "admin",
  });

  await syncScraperDefinitions(
    createScraperRegistry({ targets: [], sources: [] }),
  );

  expect(await db.select().from(scrapeTargets)).toEqual([
    expect.objectContaining({
      key: "admin-source",
      owner: "admin",
      enabled: true,
    }),
  ]);
  expect(await db.select().from(scrapeOrigins)).toEqual([
    expect.objectContaining({
      origin: "https://admin-source.test",
      owner: "admin",
      active: true,
    }),
  ]);
  expect(await db.select().from(externalSiteScrapeTargets)).toEqual([
    expect.objectContaining({
      externalSiteId: site.id,
      owner: "admin",
      active: true,
    }),
  ]);
});

test("fails when a source site has not been synchronized", async () => {
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        origins: [
          { origin: "https://example.com", robots: { mode: "enforce" } },
        ],
      }),
    ],
    sources: [source("finedrams", ["operator"])],
  });

  await expect(syncScraperDefinitions(registry)).rejects.toThrow(
    /must be synchronized/,
  );
  expect(await db.select().from(scrapeTargets)).toHaveLength(0);
});
