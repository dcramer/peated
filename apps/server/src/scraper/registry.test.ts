import { EXTERNAL_SITE_DEFINITIONS } from "@peated/server/constants";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { createScraperLifecycle } from "./lifecycle";
import { scraperRegistry } from "./registry";
import { externalReviewSink } from "./sinks/externalReviews";

const registeredSources = [
  "astorwines",
  "berrybrosrudd",
  "douglaslaing",
  "dramface",
  "dramfool",
  "finedrams",
  "fredminnick",
  "glenallachie",
  "healthyspirits",
  "masterofmalt",
  "missionliquor",
  "reservebar",
  "smws",
  "smwsa",
  "singlecasknation",
  "totalwine",
  "whiskyadvocate",
  "whiskyfun",
  "whiskyworld",
  "woodencork",
];

const registeredReviewSources = [
  "dramface",
  "fredminnick",
  "whiskyadvocate",
  "whiskyfun",
];

const configuredSources = [
  "bourbonculture",
  "bruichladdich",
  "cadenheads",
  "compassbox",
  "decadentdrinks",
  "edradour",
  "gordonmacphail",
  "kilchoman",
  "ncnean",
  "northstarspirits",
  "thompsonbros",
  "whiskeyreviewer",
  "whiskysaga",
  "whiskystudy",
  "whiskynotes",
  "wordsofwhisky",
];

function expectHourlyLimit(key: string, requests: number) {
  expect(scraperRegistry.targets.get(key)).toMatchObject({
    requestsPerWindow: requests,
    windowMs: 60 * 60_000,
  });
}

test("registers each built-in scraper source with its target", () => {
  expect([...scraperRegistry.sources.keys()].sort()).toEqual(
    registeredSources.sort(),
  );
  for (const source of scraperRegistry.sources.values()) {
    expect(source.targetKeys).toEqual([source.externalSiteKey]);
    expect(scraperRegistry.targets.get(source.targetKeys[0])).toBeDefined();
  }
  expect(scraperRegistry.targets.get("astorwines")?.enabled).toBe(true);
  expect(EXTERNAL_SITE_DEFINITIONS.astorwines.initialRunEvery).toBeNull();
  expect(EXTERNAL_SITE_DEFINITIONS.berrybrosrudd.initialRunEvery).toBeNull();
  expect(EXTERNAL_SITE_DEFINITIONS.dramfool.initialRunEvery).toBe(10080);
  expect(scraperRegistry.targets.get("dramfool")?.enabled).toBe(true);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyworld.initialRunEvery).toBeNull();
  expect(scraperRegistry.targets.get("totalwine")?.enabled).toBe(false);
  expect(
    scraperRegistry.targets.get("smws")?.origins.map(({ origin }) => origin),
  ).toEqual(["https://api.smws.com", "https://smws.com"]);
  expect(scraperRegistry.targets.get("smws")?.allowedRequestHeaders).toEqual([
    "authorization",
    "content-type",
  ]);
  expectHourlyLimit("smws", 80);
  expect(
    scraperRegistry.targets.get("smwsa")?.origins.map(({ origin }) => origin),
  ).toEqual(["https://newmake.smwsa.com", "https://smwsa.com"]);
  expect(EXTERNAL_SITE_DEFINITIONS.bourbonculture.initialRunEvery).toBe(1440);
  expectHourlyLimit("bourbonculture", 10);
  expect(scraperRegistry.targets.get("bruichladdich")).toBeDefined();
  expect(scraperRegistry.targets.get("compassbox")).toBeDefined();
  expect(EXTERNAL_SITE_DEFINITIONS.dramface.initialRunEvery).toBe(1440);
  expectHourlyLimit("dramface", 25);
  expect(EXTERNAL_SITE_DEFINITIONS.fredminnick.initialRunEvery).toBe(1440);
  expectHourlyLimit("fredminnick", 10);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskeyreviewer.initialRunEvery).toBe(1440);
  expectHourlyLimit("whiskeyreviewer", 10);
  expect(scraperRegistry.targets.get("kilchoman")).toBeDefined();
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyadvocate.initialRunEvery).toBeNull();
  expectHourlyLimit("whiskyadvocate", 120);
  expect(scraperRegistry.sources.get("whiskyadvocate")?.resumeFromLastRun).toBe(
    true,
  );
  expect(EXTERNAL_SITE_DEFINITIONS.whiskynotes.initialRunEvery).toBe(1440);
  expectHourlyLimit("whiskynotes", 30);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyfun.initialRunEvery).toBe(1440);
  expectHourlyLimit("whiskyfun", 25);
  expect(scraperRegistry.sources.get("whiskyfun")?.resumeFromLastRun).toBe(
    true,
  );
  expect(EXTERNAL_SITE_DEFINITIONS.whiskysaga.initialRunEvery).toBe(1440);
  expectHourlyLimit("whiskysaga", 25);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskystudy.initialRunEvery).toBe(1440);
  expectHourlyLimit("whiskystudy", 25);
  expect(EXTERNAL_SITE_DEFINITIONS.wordsofwhisky.initialRunEvery).toBe(1440);
  expectHourlyLimit("wordsofwhisky", 25);
  for (const type of registeredReviewSources) {
    const source = scraperRegistry.sources.get(type);
    expect(source, `${type} is not registered`).toBeDefined();
    expect(source?.observationSchema).toBe(
      ExternalReviewArticleIngestionSchema,
    );
    expect(source?.sink).toBe(externalReviewSink);
  }
  for (const type of configuredSources) {
    expect(scraperRegistry.sources.has(type), `${type} is configured`).toBe(
      false,
    );
    expect(scraperRegistry.targets.has(type), `${type} keeps its target`).toBe(
      true,
    );
  }
});

test("dispatches built-in sources to the scraper job", async ({ fixtures }) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "dramfool" });
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
