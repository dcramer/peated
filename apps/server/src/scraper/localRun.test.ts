import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import type { z } from "zod";
import {
  FixtureCursorSchema,
  FixtureObservationSchema,
  type FixturePageSchema,
  fixtureScraperAdapter,
} from "./adapters/fixture";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import type { ScraperHttpClock } from "./http";
import { runLocalScraperSource } from "./localRun";

type FixtureObservation = z.infer<typeof FixtureObservationSchema>;
type FixturePage = z.infer<typeof FixturePageSchema>;

function fixedClock(): ScraperHttpClock {
  let now = new Date("2026-09-24T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
  };
}

function fixtureRegistry(observations: Map<string, FixtureObservation>) {
  return createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "fixture-target",
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
        recordType: "price",
        targetKeys: ["fixture-target"],
        cursorSchema: FixtureCursorSchema,
        observationSchema: FixtureObservationSchema,
        adapter: fixtureScraperAdapter,
        sink: async ({ observation }) => {
          observations.set(observation.sourceKey, observation.value);
          return { newItemCount: 1, existingItemCount: 0 };
        },
      }),
    ],
  });
}

function pageFetch() {
  const pages = new Map<number, FixturePage>([
    [1, { items: [{ id: "a", value: "A" }], nextPage: 2 }],
    [2, { items: [{ id: "b", value: "B" }], nextPage: null }],
  ]);
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const page = pages.get(Number(url.searchParams.get("page")));
    return page
      ? new Response(JSON.stringify(page))
      : new Response(null, { status: 404 });
  });
}

test("runs a built-in source through the runtime and saves through its sink", async () => {
  const observations = new Map<string, FixtureObservation>();
  const fetchImpl = pageFetch();

  const run = await runLocalScraperSource(
    { site: "finedrams" },
    {
      registry: fixtureRegistry(observations),
      fetchImpl,
      clock: fixedClock(),
    },
  );

  expect(run).toMatchObject({
    status: "succeeded",
    trigger: "manual",
    requestCount: 2,
    emittedItemCount: 2,
    newItemCount: 2,
    cursor: { page: 2 },
  });
  expect(observations).toEqual(
    new Map([
      ["a", { id: "a", value: "A" }],
      ["b", { id: "b", value: "B" }],
    ]),
  );
  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "finedrams"));
  expect(site?.lastRunId).toBe(run.id);
});

test("rejects a site without a built-in source", async () => {
  await expect(
    runLocalScraperSource(
      { site: "whiskystudy" },
      { registry: fixtureRegistry(new Map()), fetchImpl: pageFetch() },
    ),
  ).rejects.toThrow("whiskystudy is not a built-in scraper source");
});

test("refuses to start beside an active run", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "finedrams" });
  await db.insert(externalSiteRuns).values({
    externalSiteId: site.id,
    trigger: "manual",
    status: "running",
  });

  await expect(
    runLocalScraperSource(
      { site: "finedrams" },
      { registry: fixtureRegistry(new Map()), fetchImpl: pageFetch() },
    ),
  ).rejects.toThrow("already has an active run");
});
