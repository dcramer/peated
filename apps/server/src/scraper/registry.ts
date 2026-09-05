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
import scrapeBruichladdich from "./adapters/legacy/scrapeBruichladdich";
import scrapeCadenheads from "./adapters/legacy/scrapeCadenheads";
import scrapeDecadentDrinks from "./adapters/legacy/scrapeDecadentDrinks";
import scrapeDouglasLaing from "./adapters/legacy/scrapeDouglasLaing";
import scrapeDramfool from "./adapters/legacy/scrapeDramfool";
import scrapeEdradour from "./adapters/legacy/scrapeEdradour";
import scrapeFineDrams from "./adapters/legacy/scrapeFineDrams";
import scrapeGlenAllachie from "./adapters/legacy/scrapeGlenAllachie";
import scrapeHealthySpirits from "./adapters/legacy/scrapeHealthySpirits";
import scrapeMasterOfMalt from "./adapters/legacy/scrapeMasterOfMalt";
import scrapeMissionLiquor from "./adapters/legacy/scrapeMissionLiquor";
import scrapeNcnean from "./adapters/legacy/scrapeNcnean";
import scrapeNorthStarSpirits from "./adapters/legacy/scrapeNorthStarSpirits";
import scrapeReserveBar from "./adapters/legacy/scrapeReserveBar";
import scrapeSingleCaskNation from "./adapters/legacy/scrapeSingleCaskNation";
import scrapeSMWS from "./adapters/legacy/scrapeSMWS";
import scrapeSMWSA from "./adapters/legacy/scrapeSMWSA";
import scrapeThompsonBros from "./adapters/legacy/scrapeThompsonBros";
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
  whiskyNotesAdapter,
  WhiskyNotesCursorSchema,
  WhiskyNotesObservationSchema,
} from "./adapters/whiskyNotes";
import {
  wordsOfWhiskyAdapter,
  WordsOfWhiskyCursorSchema,
  WordsOfWhiskyObservationSchema,
} from "./adapters/wordsOfWhisky";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import { loadSingleCaskNationReleases } from "./singleCaskNationReleases";
import { bottleObservationSink } from "./sinks/bottles";
import { externalReviewSink } from "./sinks/externalReviews";
import { createStorePriceSink } from "./sinks/storePrices";

// TODO(scraper-source-migration): Delete these ordinary HTML adapters after
// every site has an active database-managed parsing revision. New HTML sources
// must use configured rules instead of joining this compatibility group.
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
    type: "bruichladdich",
    origin: "https://www.bruichladdich.com",
    scrape: scrapeBruichladdich,
  },
  {
    type: "cadenheads",
    origin: "https://www.cadenhead.shop",
    scrape: scrapeCadenheads,
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
    type: "edradour",
    origin: "https://www.edradour.com",
    scrape: scrapeEdradour,
  },
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
  { type: "ncnean", origin: "https://ncnean.com", scrape: scrapeNcnean },
  {
    type: "northstarspirits",
    origin: "https://northstarspirits.com",
    scrape: scrapeNorthStarSpirits,
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
    type: "thompsonbros",
    origin: "https://www.thompsonbrosdistillers.com",
    scrape: scrapeThompsonBros,
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

// Custom adapters remain available for sources that configured parsing cannot
// express. SMWS emits bottle-catalog observations from an API, not HTML review
// or price observations.
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
            ? source.allowedRequestHeaders
            : undefined,
        origins: [{ origin: source.origin, robots: { mode: "enforce" } }],
      }),
    ),
    ...legacyBottleSources.map((source) =>
      defineScrapeTarget({
        key: source.type,
        allowedRequestHeaders:
          source.type === "smws" ? ["authorization", "content-type"] : [],
        requestsPerWindow: source.type === "smws" ? 80 : undefined,
        policyException:
          source.type === "smws"
            ? {
                rationale:
                  "The official weekly SMWS archive sync uses public batch APIs and about 74 requests with two-second spacing.",
              }
            : undefined,
        origins: source.origins,
      }),
    ),
    defineScrapeTarget({
      key: "bourbonculture",
      minimumSpacingMs: 5_000,
      requestsPerWindow: 10,
      origins: [
        {
          origin: "https://thebourbonculture.com",
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
      minimumSpacingMs: 2_500,
      requestsPerWindow: 25,
      origins: [
        {
          origin: "https://www.dramface.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "fredminnick",
      minimumSpacingMs: 30_000,
      requestsPerWindow: 10,
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
      key: "whiskeyreviewer",
      minimumSpacingMs: 5_000,
      requestsPerWindow: 10,
      origins: [
        {
          origin: "https://whiskeyreviewer.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskyadvocate",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 20,
      origins: [
        {
          origin: "https://whiskyadvocate.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskynotes",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 30,
      origins: [
        {
          origin: "https://www.whiskynotes.be",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskyfun",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 25,
      origins: [
        {
          origin: "https://www.whiskyfun.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskysaga",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 25,
      origins: [
        {
          origin: "https://www.whiskysaga.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "whiskystudy",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 25,
      origins: [
        {
          origin: "https://thewhiskystudy.com",
          robots: { mode: "enforce" },
        },
      ],
    }),
    defineScrapeTarget({
      key: "wordsofwhisky",
      minimumSpacingMs: 2_500,
      requestsPerWindow: 25,
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
        targetKeys: [source.type],
        cursorSchema: z.null(),
        observationSchema: LegacyBottleObservationSchema,
        adapter: createLegacyBottleAdapter(source.type, source.scrape),
        sink: bottleObservationSink,
      }),
    ),
    // TODO(scraper-source-migration): Remove each remaining HTML review
    // definition after its publisher activates database-managed rules.
    defineScraperSource({
      key: "dramface",
      externalSiteKey: "dramface",
      targetKeys: ["dramface"],
      requestLimit: 30,
      cursorSchema: DramfaceCursorSchema,
      observationSchema: DramfaceObservationSchema,
      adapter: dramfaceAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "fredminnick",
      externalSiteKey: "fredminnick",
      targetKeys: ["fredminnick"],
      requestLimit: 9,
      cursorSchema: FredMinnickCursorSchema,
      observationSchema: FredMinnickObservationSchema,
      adapter: fredMinnickAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyadvocate",
      externalSiteKey: "whiskyadvocate",
      targetKeys: ["whiskyadvocate"],
      // Keep the slice budget above the target quota so one hourly deferral
      // consumes one execution attempt.
      requestLimit: 30,
      resumeFromLastRun: true,
      cursorSchema: WhiskyAdvocateCursorSchema,
      observationSchema: WhiskyAdvocateObservationSchema,
      adapter: whiskyAdvocateAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskynotes",
      externalSiteKey: "whiskynotes",
      targetKeys: ["whiskynotes"],
      requestLimit: 30,
      resumeFromLastRun: true,
      cursorSchema: WhiskyNotesCursorSchema,
      observationSchema: WhiskyNotesObservationSchema,
      adapter: whiskyNotesAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyfun",
      externalSiteKey: "whiskyfun",
      targetKeys: ["whiskyfun"],
      requestLimit: 30,
      resumeFromLastRun: true,
      cursorSchema: WhiskyfunCursorSchema,
      observationSchema: WhiskyfunObservationSchema,
      adapter: whiskyfunAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "wordsofwhisky",
      externalSiteKey: "wordsofwhisky",
      targetKeys: ["wordsofwhisky"],
      requestLimit: 25,
      cursorSchema: WordsOfWhiskyCursorSchema,
      observationSchema: WordsOfWhiskyObservationSchema,
      adapter: wordsOfWhiskyAdapter,
      sink: externalReviewSink,
    }),
  ],
});
