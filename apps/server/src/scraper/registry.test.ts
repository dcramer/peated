import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  storePrices,
} from "@peated/server/db/schema";
import { syncExternalSites } from "@peated/server/lib/externalSites";
import { loadFixture } from "@peated/server/lib/test/fixtures";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import type { ScraperHttpClock } from "./http";
import { createScraperLifecycle } from "./lifecycle";
import { scraperRegistry } from "./registry";
import { executeScraperRun } from "./runs";
import { syncScraperDefinitions } from "./syncDefinitions";

const migratedSources = [
  "astorwines",
  "berrybrosrudd",
  "bruichladdich",
  "cadenheads",
  "compassbox",
  "decadentdrinks",
  "douglaslaing",
  "dramfool",
  "edradour",
  "finedrams",
  "glenallachie",
  "gordonmacphail",
  "healthyspirits",
  "kilchoman",
  "masterofmalt",
  "missionliquor",
  "ncnean",
  "northstarspirits",
  "reservebar",
  "smws",
  "smwsa",
  "singlecasknation",
  "thompsonbros",
  "totalwine",
  "whiskyadvocate",
  "whiskyworld",
  "woodencork",
];

function runtimeClock(): ScraperHttpClock {
  let now = new Date("2026-08-18T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
  };
}

test("registers every scraper source with explicit target ownership", () => {
  expect([...scraperRegistry.sources.keys()].sort()).toEqual(
    migratedSources.sort(),
  );
  for (const source of scraperRegistry.sources.values()) {
    expect(source.targetKeys).toEqual([source.externalSiteType]);
    expect(scraperRegistry.targets.get(source.targetKeys[0])).toBeDefined();
  }
  expect(scraperRegistry.targets.get("astorwines")?.enabled).toBe(false);
  expect(scraperRegistry.targets.get("totalwine")?.enabled).toBe(false);
});

test("runs Bruichladdich through the production runtime with fixture parity", async () => {
  await syncExternalSites();
  await syncScraperDefinitions(scraperRegistry);
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "bruichladdich"));
  if (!site) throw new Error("Expected synchronized site.");
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit: 100,
    })
    .returning();
  if (!run) throw new Error("Expected run.");
  const fixture = await loadFixture("bruichladdich", "bottle-list.json");
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response(null, { status: 404 });
    }
    if (url.searchParams.get("page") === "1") return new Response(fixture);
    return new Response(JSON.stringify({ products: [] }));
  });

  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry: scraperRegistry,
        fetchImpl,
        clock: runtimeClock(),
        executionToken: "owner",
      },
    ),
  ).resolves.toEqual({ status: "completed" });

  expect(
    await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id)),
  ).toHaveLength(4);
  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  expect(storedRun).toMatchObject({
    status: "succeeded",
    requestCount: 3,
    emittedItemCount: 4,
    itemCount: 4,
    cursor: { sequence: 1, page: 1 },
  });
});

test("dispatches migrated sources to the isolated scraper job", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "bruichladdich" });
  const enqueue = vi.fn(async () => undefined);

  const run = await createScraperLifecycle({
    registry: scraperRegistry,
    enqueue,
  }).queueManualExternalSiteRun({ site, requestedById: requestedBy.id });

  expect(run.requestLimit).toBe(100);
  expect(enqueue).toHaveBeenCalledWith(
    "RunScraper",
    { runId: run.id },
    {
      jobId: `external-site-run-${run.id}`,
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
});
