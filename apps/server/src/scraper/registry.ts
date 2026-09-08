import { z } from "zod";
import {
  dramfaceAdapter,
  DramfaceCursorSchema,
  DramfaceObservationSchema,
} from "./adapters/dramface";
import {
  fredMinnickAdapter,
  FredMinnickCursorSchema,
  FredMinnickObservationSchema,
} from "./adapters/fredMinnick";
import scrapeAstorWines from "./adapters/legacy/scrapeAstorWines";
import scrapeBerryBrosRudd from "./adapters/legacy/scrapeBerryBrosRudd";
import scrapeDecadentDrinks from "./adapters/legacy/scrapeDecadentDrinks";
import scrapeDouglasLaing from "./adapters/legacy/scrapeDouglasLaing";
import scrapeDramfool from "./adapters/legacy/scrapeDramfool";
import scrapeFineDrams from "./adapters/legacy/scrapeFineDrams";
import scrapeGlenAllachie from "./adapters/legacy/scrapeGlenAllachie";
import scrapeHealthySpirits from "./adapters/legacy/scrapeHealthySpirits";
import scrapeMasterOfMalt from "./adapters/legacy/scrapeMasterOfMalt";
import scrapeMissionLiquor from "./adapters/legacy/scrapeMissionLiquor";
import scrapeReserveBar from "./adapters/legacy/scrapeReserveBar";
import scrapeSingleCaskNation from "./adapters/legacy/scrapeSingleCaskNation";
import scrapeSMWS from "./adapters/legacy/scrapeSMWS";
import scrapeSMWSA from "./adapters/legacy/scrapeSMWSA";
import scrapeTotalWine from "./adapters/legacy/scrapeTotalWine";
import scrapeWhiskyWorld from "./adapters/legacy/scrapeWhiskyWorld";
import scrapeWoodenCork from "./adapters/legacy/scrapeWoodenCork";
import {
  createLegacyBottleAdapter,
  LegacyBottleObservationSchema,
} from "./adapters/legacyBottle";
import {
  createLegacyPriceAdapter,
  LegacyPriceCursorSchema,
  StorePriceBatchSchema,
} from "./adapters/legacyPrice";
import {
  whiskyAdvocateAdapter,
  WhiskyAdvocateCursorSchema,
  WhiskyAdvocateObservationSchema,
} from "./adapters/whiskyAdvocate";
import {
  whiskyfunAdapter,
  WhiskyfunCursorSchema,
  WhiskyfunObservationSchema,
} from "./adapters/whiskyfun";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import { loadSingleCaskNationReleases } from "./singleCaskNationReleases";
import { bottleObservationSink } from "./sinks/bottles";
import { externalReviewSink } from "./sinks/externalReviews";
import { createStorePriceSink } from "./sinks/storePrices";

// TODO(scraper-source-migration): Delete these HTML adapters after every site
// uses saved parsing rules. New HTML sources must use those rules.
const legacyPriceSources = [
  {
    type: "astorwines",
    origin: "https://www.astorwines.com",
    scrape: scrapeAstorWines,
  },
  {
    type: "berrybrosrudd",
    origin: "https://www.bbr.com",
    scrape: scrapeBerryBrosRudd,
  },
  {
    type: "decadentdrinks",
    origin: "https://decadent-drinks.com",
    scrape: scrapeDecadentDrinks,
  },
  {
    type: "douglaslaing",
    origin: "https://www.douglaslaing.com",
    scrape: scrapeDouglasLaing,
  },
  { type: "dramfool", origin: "https://dramfool.com", scrape: scrapeDramfool },
  {
    type: "finedrams",
    origin: "https://www.finedrams.com",
    scrape: scrapeFineDrams,
  },
  {
    type: "glenallachie",
    origin: "https://shop.theglenallachie.com",
    scrape: scrapeGlenAllachie,
  },
  {
    type: "healthyspirits",
    origin: "https://us-vir5-storefront-api.ecwid.com",
    scrape: scrapeHealthySpirits,
  },
  {
    type: "missionliquor",
    origin: "https://www.missionliquor.com",
    scrape: scrapeMissionLiquor,
  },
  {
    type: "masterofmalt",
    origin: "https://ll7rrres19-dsn.algolia.net",
    allowedRequestHeaders: ["x-algolia-api-key", "x-algolia-application-id"],
    scrape: scrapeMasterOfMalt,
  },
  {
    type: "reservebar",
    origin: "https://api.liquidcommerce.cloud",
    allowedRequestHeaders: [
      "authorization",
      "x-liquid-api-key",
      "x-liquid-api-obf",
      "x-liquid-api-sdk",
      "x-liquid-sdk-version",
    ],
    scrape: scrapeReserveBar,
  },
  {
    type: "singlecasknation",
    origin: "https://singlecasknation.com",
    scrape: (options?: { dryRun?: boolean }) =>
      scrapeSingleCaskNation(options, loadSingleCaskNationReleases),
  },
  {
    type: "totalwine",
    origin: "https://www.totalwine.com",
    enabled: false,
    scrape: scrapeTotalWine,
  },
  {
    type: "whiskyworld",
    origin: "https://www.thewhiskyworld.com",
    scrape: scrapeWhiskyWorld,
  },
  {
    type: "woodencork",
    origin: "https://woodencork.com",
    scrape: scrapeWoodenCork,
  },
] as const;

// Some sources still need their own adapters. SMWS reads bottles from an API,
// not reviews or prices from HTML.
const legacyBottleSources = [
  {
    type: "smws",
    origins: [
      { origin: "https://api.smws.com", robots: { mode: "enforce" } },
      { origin: "https://smws.com", robots: { mode: "enforce" } },
    ],
    scrape: scrapeSMWS,
  },
  {
    type: "smwsa",
    origins: [
      {
        origin: "https://newmake.smwsa.com",
        robots: { mode: "enforce" },
      },
    ],
    scrape: scrapeSMWSA,
  },
] as const;

export const scraperRegistry = createScraperRegistry({
  targets: [
    ...legacyPriceSources.map((source) =>
      defineScrapeTarget({
        key: source.type,
        enabled: "enabled" in source ? source.enabled : true,
        allowedRequestHeaders:
          "allowedRequestHeaders" in source
            ? [...source.allowedRequestHeaders]
            : undefined,
        origins: [{ origin: source.origin, robots: { mode: "enforce" } }],
      }),
    ),
    ...legacyBottleSources.map((source) =>
      defineScrapeTarget({
        key: source.type,
        allowedRequestHeaders:
          source.type === "smws" ? ["authorization", "content-type"] : [],
        requestsPerHour: source.type === "smws" ? 80 : undefined,
        fasterRateReason:
          source.type === "smws"
            ? "Copying the weekly SMWS bottle list needs about 74 requests."
            : undefined,
        origins: [...source.origins],
      }),
    ),
    defineScrapeTarget({
      key: "bourbonculture",
      requestsPerHour: 10,
      origins: [
        {
          origin: "https://thebourbonculture.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "bruichladdich",
      origins: [
        {
          origin: "https://www.bruichladdich.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "cadenheads",
      origins: [
        {
          origin: "https://www.cadenhead.shop",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "compassbox",
      origins: [
        {
          origin: "https://www.compassboxwhisky.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "edradour",
      origins: [
        {
          origin: "https://www.edradour.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "gordonmacphail",
      origins: [
        {
          origin: "https://shop.gordonandmacphail.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "dramface",
      requestsPerHour: 25,
      origins: [
        {
          origin: "https://www.dramface.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "fredminnick",
      requestsPerHour: 10,
      origins: [
        {
          origin: "https://www.fredminnick.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "kilchoman",
      origins: [
        {
          origin: "https://www.kilchomandistillery.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "ncnean",
      origins: [
        {
          origin: "https://ncnean.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "northstarspirits",
      origins: [
        {
          origin: "https://northstarspirits.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "thompsonbros",
      origins: [
        {
          origin: "https://www.thompsonbrosdistillers.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskeyreviewer",
      requestsPerHour: 10,
      origins: [
        {
          origin: "https://whiskeyreviewer.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskyadvocate",
      origins: [
        {
          origin: "https://whiskyadvocate.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskynotes",
      requestsPerHour: 30,
      origins: [
        {
          origin: "https://www.whiskynotes.be",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskyfun",
      requestsPerHour: 25,
      origins: [
        {
          origin: "https://www.whiskyfun.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskysaga",
      requestsPerHour: 25,
      origins: [
        {
          origin: "https://www.whiskysaga.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskystudy",
      requestsPerHour: 25,
      origins: [
        {
          origin: "https://thewhiskystudy.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "wordsofwhisky",
      requestsPerHour: 25,
      origins: [
        {
          origin: "https://wordsofwhisky.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
  ],
  sources: [
    ...legacyPriceSources.map((source) =>
      defineScraperSource({
        key: source.type,
        externalSiteKey: source.type,
        recordType: "price",
        targetKeys: [source.type],
        cursorSchema: LegacyPriceCursorSchema,
        observationSchema: StorePriceBatchSchema,
        adapter: createLegacyPriceAdapter(source.type, source.scrape),
        sink: createStorePriceSink(source.type),
      }),
    ),
    ...legacyBottleSources.map((source) =>
      defineScraperSource({
        key: source.type,
        externalSiteKey: source.type,
        recordType: "bottle",
        targetKeys: [source.type],
        cursorSchema: z.null(),
        observationSchema: LegacyBottleObservationSchema,
        adapter: createLegacyBottleAdapter(source.type, source.scrape),
        sink: bottleObservationSink,
      }),
    ),
    // TODO(scraper-source-migration): Remove each remaining HTML review
    // definition after its publisher turns on saved parsing rules.
    defineScraperSource({
      key: "dramface",
      externalSiteKey: "dramface",
      recordType: "review",
      targetKeys: ["dramface"],
      cursorSchema: DramfaceCursorSchema,
      observationSchema: DramfaceObservationSchema,
      adapter: dramfaceAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "fredminnick",
      externalSiteKey: "fredminnick",
      recordType: "review",
      targetKeys: ["fredminnick"],
      cursorSchema: FredMinnickCursorSchema,
      observationSchema: FredMinnickObservationSchema,
      adapter: fredMinnickAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyadvocate",
      externalSiteKey: "whiskyadvocate",
      recordType: "review",
      targetKeys: ["whiskyadvocate"],
      resumeFromLastRun: true,
      cursorSchema: WhiskyAdvocateCursorSchema,
      observationSchema: WhiskyAdvocateObservationSchema,
      adapter: whiskyAdvocateAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyfun",
      externalSiteKey: "whiskyfun",
      recordType: "review",
      targetKeys: ["whiskyfun"],
      resumeFromLastRun: true,
      cursorSchema: WhiskyfunCursorSchema,
      observationSchema: WhiskyfunObservationSchema,
      adapter: whiskyfunAdapter,
      sink: externalReviewSink,
    }),
  ],
});
