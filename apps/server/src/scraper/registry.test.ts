import { EXTERNAL_SITE_DEFINITIONS } from "@peated/server/constants";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { createScraperLifecycle } from "./lifecycle";
import { scraperRegistry } from "./registry";
import { externalReviewSink } from "./sinks/externalReviews";

const registeredSources = [
  "astorwines",
  "berrybrosrudd",
  "decadentdrinks",
  "douglaslaing",
  "dramface",
  "dramfool",
  "edradour",
  "finedrams",
  "fredminnick",
  "glenallachie",
  "healthyspirits",
  "masterofmalt",
  "missionliquor",
  "ncnean",
  "reservebar",
  "smws",
  "smwsa",
  "singlecasknation",
  "thompsonbros",
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
  "gordonmacphail",
  "kilchoman",
  "northstarspirits",
  "whiskeyreviewer",
  "whiskysaga",
  "whiskystudy",
  "whiskynotes",
  "wordsofwhisky",
];

test("registers each code-owned scraper source with explicit target ownership", () => {
  expect([...scraperRegistry.sources.keys()].sort()).toEqual(
    registeredSources.sort(),
  );
  for (const source of scraperRegistry.sources.values()) {
    expect(source.targetKeys).toEqual([source.externalSiteKey]);
    expect(scraperRegistry.targets.get(source.targetKeys[0])).toBeDefined();
  }
  expect(scraperRegistry.targets.get("astorwines")?.enabled).toBe(true);
  expect(EXTERNAL_SITE_DEFINITIONS.astorwines.runEvery).toBeNull();
  expect(EXTERNAL_SITE_DEFINITIONS.dramfool.runEvery).toBe(10080);
  expect(scraperRegistry.targets.get("dramfool")?.enabled).toBe(true);
  expect(scraperRegistry.targets.get("totalwine")?.enabled).toBe(false);
  expect(
    scraperRegistry.targets.get("smws")?.origins.map(({ origin }) => origin),
  ).toEqual(["https://api.smws.com", "https://smws.com"]);
  expect(scraperRegistry.targets.get("smws")).toMatchObject({
    allowedRequestHeaders: ["authorization", "content-type"],
    minimumSpacingMs: 2_000,
    requestsPerWindow: 80,
  });
  expect(EXTERNAL_SITE_DEFINITIONS.bourbonculture.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("bourbonculture")).toMatchObject({
    minimumSpacingMs: 5_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.targets.get("bruichladdich")).toBeDefined();
  expect(scraperRegistry.targets.get("compassbox")).toBeDefined();
  expect(EXTERNAL_SITE_DEFINITIONS.dramface.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("dramface")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("dramface")?.requestLimit).toBe(30);
  expect(EXTERNAL_SITE_DEFINITIONS.fredminnick.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("fredminnick")).toMatchObject({
    minimumSpacingMs: 30_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("fredminnick")?.requestLimit).toBe(9);
  expect(EXTERNAL_SITE_DEFINITIONS.whiskeyreviewer.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskeyreviewer")).toMatchObject({
    minimumSpacingMs: 5_000,
    requestsPerWindow: 10,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.targets.get("kilchoman")).toBeDefined();
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyadvocate.runEvery).toBeNull();
  expect(scraperRegistry.targets.get("whiskyadvocate")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 20,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskyadvocate")?.requestLimit).toBe(30);
  expect(scraperRegistry.sources.get("whiskyadvocate")?.resumeFromLastRun).toBe(
    true,
  );
  expect(EXTERNAL_SITE_DEFINITIONS.whiskynotes.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskynotes")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 30,
    windowMs: 3_600_000,
  });
  expect(EXTERNAL_SITE_DEFINITIONS.whiskyfun.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskyfun")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(scraperRegistry.sources.get("whiskyfun")?.requestLimit).toBe(30);
  expect(scraperRegistry.sources.get("whiskyfun")?.resumeFromLastRun).toBe(
    true,
  );
  expect(EXTERNAL_SITE_DEFINITIONS.whiskysaga.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskysaga")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(EXTERNAL_SITE_DEFINITIONS.whiskystudy.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("whiskystudy")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
  expect(EXTERNAL_SITE_DEFINITIONS.wordsofwhisky.runEvery).toBe(1440);
  expect(scraperRegistry.targets.get("wordsofwhisky")).toMatchObject({
    minimumSpacingMs: 2_500,
    requestsPerWindow: 25,
    windowMs: 3_600_000,
  });
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

test("dispatches code-owned sources to the isolated scraper job", async ({
  fixtures,
}) => {
  const requestedBy = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({ type: "edradour" });
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
