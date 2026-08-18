import { db } from "@peated/server/db";
import { requireExternalReviewSourceCapability } from "@peated/server/lib/externalReviewSourcePolicy";
import scrapeAstorWines from "@peated/server/worker/jobs/scrapeAstorWines";
import scrapeBerryBrosRudd from "@peated/server/worker/jobs/scrapeBerryBrosRudd";
import scrapeBruichladdich from "@peated/server/worker/jobs/scrapeBruichladdich";
import scrapeCadenheads from "@peated/server/worker/jobs/scrapeCadenheads";
import scrapeCompassBox from "@peated/server/worker/jobs/scrapeCompassBox";
import scrapeDecadentDrinks from "@peated/server/worker/jobs/scrapeDecadentDrinks";
import scrapeDouglasLaing from "@peated/server/worker/jobs/scrapeDouglasLaing";
import scrapeDramfool from "@peated/server/worker/jobs/scrapeDramfool";
import scrapeEdradour from "@peated/server/worker/jobs/scrapeEdradour";
import scrapeFineDrams from "@peated/server/worker/jobs/scrapeFineDrams";
import scrapeGlenAllachie from "@peated/server/worker/jobs/scrapeGlenAllachie";
import scrapeGordonMacphail from "@peated/server/worker/jobs/scrapeGordonMacphail";
import scrapeHealthySpirits from "@peated/server/worker/jobs/scrapeHealthySpirits";
import scrapeKilchoman from "@peated/server/worker/jobs/scrapeKilchoman";
import scrapeMasterOfMalt from "@peated/server/worker/jobs/scrapeMasterOfMalt";
import scrapeMissionLiquor from "@peated/server/worker/jobs/scrapeMissionLiquor";
import scrapeNcnean from "@peated/server/worker/jobs/scrapeNcnean";
import scrapeNorthStarSpirits from "@peated/server/worker/jobs/scrapeNorthStarSpirits";
import scrapeReserveBar from "@peated/server/worker/jobs/scrapeReserveBar";
import scrapeSMWS from "@peated/server/worker/jobs/scrapeSMWS";
import scrapeSMWSA from "@peated/server/worker/jobs/scrapeSMWSA";
import scrapeSingleCaskNation from "@peated/server/worker/jobs/scrapeSingleCaskNation";
import scrapeThompsonBros from "@peated/server/worker/jobs/scrapeThompsonBros";
import scrapeTotalWine from "@peated/server/worker/jobs/scrapeTotalWine";
import scrapeWhiskyWorld from "@peated/server/worker/jobs/scrapeWhiskyWorld";
import scrapeWoodenCork from "@peated/server/worker/jobs/scrapeWoodenCork";
import { z } from "zod";
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
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
} from "./definitions";
import { bottleObservationSink } from "./sinks/bottles";
import { whiskyAdvocateReviewSink } from "./sinks/externalReviews";
import { createStorePriceSink } from "./sinks/storePrices";

const legacyPriceSources = [
  {
    type: "astorwines",
    origin: "https://www.astorwines.com",
    enabled: false,
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
      key: "whiskyadvocate",
      origins: [
        {
          origin: "https://whiskyadvocate.com",
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
      key: "whiskyadvocate",
      externalSiteType: "whiskyadvocate",
      targetKeys: ["whiskyadvocate"],
      cursorSchema: WhiskyAdvocateCursorSchema,
      observationSchema: WhiskyAdvocateObservationSchema,
      adapter: whiskyAdvocateAdapter,
      sink: whiskyAdvocateReviewSink,
      authorize: async ({ externalSiteId, externalSiteType }) => {
        await requireExternalReviewSourceCapability(
          db,
          { id: externalSiteId, type: externalSiteType },
          "allowFetching",
        );
      },
    }),
  ],
});
