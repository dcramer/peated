import { z } from "zod";
import {
  bourbonCultureAdapter,
  BourbonCultureCursorSchema,
  BourbonCultureObservationSchema,
} from "./adapters/bourbonCulture";
import {
  dramfaceAdapter,
  DramfaceCursorSchema,
  DramfaceObservationSchema,
} from "./adapters/dramface";
import scrapeAstorWines from "./adapters/legacy/scrapeAstorWines";
import scrapeBerryBrosRudd from "./adapters/legacy/scrapeBerryBrosRudd";
import scrapeBruichladdich from "./adapters/legacy/scrapeBruichladdich";
import scrapeCadenheads from "./adapters/legacy/scrapeCadenheads";
import scrapeCompassBox from "./adapters/legacy/scrapeCompassBox";
import scrapeDecadentDrinks from "./adapters/legacy/scrapeDecadentDrinks";
import scrapeDouglasLaing from "./adapters/legacy/scrapeDouglasLaing";
import scrapeDramfool from "./adapters/legacy/scrapeDramfool";
import scrapeEdradour from "./adapters/legacy/scrapeEdradour";
import scrapeFineDrams from "./adapters/legacy/scrapeFineDrams";
import scrapeGlenAllachie from "./adapters/legacy/scrapeGlenAllachie";
import scrapeGordonMacphail from "./adapters/legacy/scrapeGordonMacphail";
import scrapeHealthySpirits from "./adapters/legacy/scrapeHealthySpirits";
import scrapeKilchoman from "./adapters/legacy/scrapeKilchoman";
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
  whiskeyReviewerAdapter,
  WhiskeyReviewerCursorSchema,
  WhiskeyReviewerObservationSchema,
} from "./adapters/whiskeyReviewer";
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
import { bottleObservationSink } from "./sinks/bottles";
import { externalReviewSink } from "./sinks/externalReviews";
import { createStorePriceSink } from "./sinks/storePrices";

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
    type: "compassbox",
    origin: "https://www.compassboxwhisky.com",
    scrape: scrapeCompassBox,
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
    type: "gordonmacphail",
    origin: "https://shop.gordonandmacphail.com",
    scrape: scrapeGordonMacphail,
  },
  {
    type: "healthyspirits",
    origin: "https://us-vir5-storefront-api.ecwid.com",
    scrape: scrapeHealthySpirits,
  },
  {
    type: "kilchoman",
    origin: "https://www.kilchomandistillery.com",
    scrape: scrapeKilchoman,
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
    scrape: scrapeSingleCaskNation,
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

const legacyBottleSources = [
  {
    type: "smws",
    origin: "https://api.smws.com",
    scrape: scrapeSMWS,
  },
  {
    type: "smwsa",
    origin: "https://newmake.smwsa.com",
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
        origins: [{ origin: source.origin, robots: { mode: "enforce" } }],
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
        externalSiteType: source.type,
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
        externalSiteType: source.type,
        targetKeys: [source.type],
        cursorSchema: z.null(),
        observationSchema: LegacyBottleObservationSchema,
        adapter: createLegacyBottleAdapter(source.type, source.scrape),
        sink: bottleObservationSink,
      }),
    ),
    defineScraperSource({
      key: "bourbonculture",
      externalSiteType: "bourbonculture",
      targetKeys: ["bourbonculture"],
      requestLimit: 7,
      cursorSchema: BourbonCultureCursorSchema,
      observationSchema: BourbonCultureObservationSchema,
      adapter: bourbonCultureAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "dramface",
      externalSiteType: "dramface",
      targetKeys: ["dramface"],
      requestLimit: 30,
      cursorSchema: DramfaceCursorSchema,
      observationSchema: DramfaceObservationSchema,
      adapter: dramfaceAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskeyreviewer",
      externalSiteType: "whiskeyreviewer",
      targetKeys: ["whiskeyreviewer"],
      requestLimit: 6,
      cursorSchema: WhiskeyReviewerCursorSchema,
      observationSchema: WhiskeyReviewerObservationSchema,
      adapter: whiskeyReviewerAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyadvocate",
      externalSiteType: "whiskyadvocate",
      targetKeys: ["whiskyadvocate"],
      // Keep the slice budget above the target quota so one hourly deferral
      // consumes one execution attempt.
      requestLimit: 30,
      cursorSchema: WhiskyAdvocateCursorSchema,
      observationSchema: WhiskyAdvocateObservationSchema,
      adapter: whiskyAdvocateAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskynotes",
      externalSiteType: "whiskynotes",
      targetKeys: ["whiskynotes"],
      requestLimit: 30,
      cursorSchema: WhiskyNotesCursorSchema,
      observationSchema: WhiskyNotesObservationSchema,
      adapter: whiskyNotesAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "whiskyfun",
      externalSiteType: "whiskyfun",
      targetKeys: ["whiskyfun"],
      requestLimit: 30,
      cursorSchema: WhiskyfunCursorSchema,
      observationSchema: WhiskyfunObservationSchema,
      adapter: whiskyfunAdapter,
      sink: externalReviewSink,
    }),
    defineScraperSource({
      key: "wordsofwhisky",
      externalSiteType: "wordsofwhisky",
      targetKeys: ["wordsofwhisky"],
      requestLimit: 25,
      cursorSchema: WordsOfWhiskyCursorSchema,
      observationSchema: WordsOfWhiskyObservationSchema,
      adapter: wordsOfWhiskyAdapter,
      sink: externalReviewSink,
    }),
  ],
});
