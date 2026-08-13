import { createExternalSiteRunJob } from "@peated/server/lib/externalSiteRuns";
import registry from "../registry";
import capturePriceImage from "./capturePriceImage";
import cleanupPendingUploads from "./cleanupPendingUploads";
import createMissingBottles from "./createMissingBottles";
import generateBottleDetails from "./generateBottleDetails";
import generateCountryDetails from "./generateCountryDetails";
import generateEntityDetails from "./generateEntityDetails";
import generateRegionDetails from "./generateRegionDetails";
import geocodeCountryLocation from "./geocodeCountryLocation";
import geocodeEntityLocation from "./geocodeEntityLocation";
import geocodeRegionLocation from "./geocodeRegionLocation";
import indexBottleAlias from "./indexBottleAlias";
import indexBottleSearchVectors from "./indexBottleSearchVectors";
import indexBottleSeriesSearchVectors from "./indexBottleSeriesSearchVectors";
import indexEntitySearchVectors from "./indexEntitySearchVectors";
import mergeEntity from "./mergeEntity";
import notifyDiscordOnTasting from "./notifyDiscordOnTasting";
import onBottleAliasChange from "./onBottleAliasChange";
import onBottleChange from "./onBottleChange";
import onEntityChange from "./onEntityChange";
import processNotification from "./processNotification";
import processStorePriceMatchRetryRun from "./processStorePriceMatchRetryRun";
import reconcileStorePriceMatchProposals from "./reconcileStorePriceMatchProposals";
import resolveStorePriceBottle from "./resolveStorePriceBottle";
import scrapeAstorWines from "./scrapeAstorWines";
import scrapeBerryBrosRudd from "./scrapeBerryBrosRudd";
import scrapeBruichladdich from "./scrapeBruichladdich";
import scrapeCadenheads from "./scrapeCadenheads";
import scrapeCompassBox from "./scrapeCompassBox";
import scrapeDecadentDrinks from "./scrapeDecadentDrinks";
import scrapeDouglasLaing from "./scrapeDouglasLaing";
import scrapeDramfool from "./scrapeDramfool";
import scrapeEdradour from "./scrapeEdradour";
import scrapeFineDrams from "./scrapeFineDrams";
import scrapeGlenAllachie from "./scrapeGlenAllachie";
import scrapeGordonMacphail from "./scrapeGordonMacphail";
import scrapeHealthySpirits from "./scrapeHealthySpirits";
import scrapeKilchoman from "./scrapeKilchoman";
import scrapeMasterOfMalt from "./scrapeMasterOfMalt";
import scrapeMissionLiquor from "./scrapeMissionLiquor";
import scrapeNcnean from "./scrapeNcnean";
import scrapeNorthStarSpirits from "./scrapeNorthStarSpirits";
import scrapeReserveBar from "./scrapeReserveBar";
import scrapeSingleCaskNation from "./scrapeSingleCaskNation";
import scrapeSMWS from "./scrapeSMWS";
import scrapeSMWSA from "./scrapeSMWSA";
import scrapeThompsonBros from "./scrapeThompsonBros";
import scrapeTotalWine from "./scrapeTotalWine";
import scrapeWhiskeyAdvocate from "./scrapeWhiskyAdvocate";
import scrapeWhiskyWorld from "./scrapeWhiskyWorld";
import scrapeWoodenCork from "./scrapeWoodenCork";
import updateBottleStats from "./updateBottleStats";
import updateCountryStats from "./updateCountryStats";
import updateEntityStats from "./updateEntityStats";
import updateRegionStats from "./updateRegionStats";
import verifyBottleCreation from "./verifyBottleCreation";
import verifyEntityCreation from "./verifyEntityCreation";

registry.add("CapturePriceImage", capturePriceImage);
registry.add("CleanupPendingUploads", cleanupPendingUploads);
registry.add("GenerateBottleDetails", generateBottleDetails);
registry.add("GenerateCountryDetails", generateCountryDetails);
registry.add("GenerateEntityDetails", generateEntityDetails);
registry.add("GenerateRegionDetails", generateRegionDetails);
registry.add("GeocodeCountryLocation", geocodeCountryLocation);
registry.add("GeocodeRegionLocation", geocodeRegionLocation);
registry.add("GeocodeEntityLocation", geocodeEntityLocation);
registry.add("IndexBottleAlias", indexBottleAlias);
registry.add("IndexBottleSearchVectors", indexBottleSearchVectors);
registry.add("IndexBottleSeriesSearchVectors", indexBottleSeriesSearchVectors);
registry.add("IndexEntitySearchVectors", indexEntitySearchVectors);
registry.add("MergeEntity", mergeEntity);
registry.add("NotifyDiscordOnTasting", notifyDiscordOnTasting);
registry.add("OnBottleAliasChange", onBottleAliasChange);
registry.add("OnBottleChange", onBottleChange);
registry.add("OnEntityChange", onEntityChange);
registry.add("ProcessNotification", processNotification);
registry.add("ProcessStorePriceMatchRetryRun", processStorePriceMatchRetryRun);
registry.add(
  "ReconcileStorePriceMatchProposals",
  reconcileStorePriceMatchProposals,
);
registry.add("ResolveStorePriceBottle", resolveStorePriceBottle);
const scraperJobs = [
  ["ScrapeAstorWines", "astorwines", scrapeAstorWines],
  ["ScrapeBerryBrosRudd", "berrybrosrudd", scrapeBerryBrosRudd],
  ["ScrapeBruichladdich", "bruichladdich", scrapeBruichladdich],
  ["ScrapeCadenheads", "cadenheads", scrapeCadenheads],
  ["ScrapeCompassBox", "compassbox", scrapeCompassBox],
  ["ScrapeDecadentDrinks", "decadentdrinks", scrapeDecadentDrinks],
  ["ScrapeDouglasLaing", "douglaslaing", scrapeDouglasLaing],
  ["ScrapeDramfool", "dramfool", scrapeDramfool],
  ["ScrapeEdradour", "edradour", scrapeEdradour],
  ["ScrapeFineDrams", "finedrams", scrapeFineDrams],
  ["ScrapeGlenAllachie", "glenallachie", scrapeGlenAllachie],
  ["ScrapeGordonMacphail", "gordonmacphail", scrapeGordonMacphail],
  ["ScrapeHealthySpirits", "healthyspirits", scrapeHealthySpirits],
  ["ScrapeKilchoman", "kilchoman", scrapeKilchoman],
  ["ScrapeMasterOfMalt", "masterofmalt", scrapeMasterOfMalt],
  ["ScrapeMissionLiquor", "missionliquor", scrapeMissionLiquor],
  ["ScrapeNcnean", "ncnean", scrapeNcnean],
  ["ScrapeNorthStarSpirits", "northstarspirits", scrapeNorthStarSpirits],
  ["ScrapeReserveBar", "reservebar", scrapeReserveBar],
  ["ScrapeSingleCaskNation", "singlecasknation", scrapeSingleCaskNation],
  ["ScrapeSMWS", "smws", scrapeSMWS],
  ["ScrapeSMWSA", "smwsa", scrapeSMWSA],
  ["ScrapeThompsonBros", "thompsonbros", scrapeThompsonBros],
  ["ScrapeTotalWine", "totalwine", scrapeTotalWine],
  ["ScrapeWoodenCork", "woodencork", scrapeWoodenCork],
  ["ScrapeWhiskyAdvocate", "whiskyadvocate", scrapeWhiskeyAdvocate],
  ["ScrapeWhiskyWorld", "whiskyworld", scrapeWhiskyWorld],
] as const;

for (const [jobName, siteType, scrape] of scraperJobs) {
  registry.add(jobName, createExternalSiteRunJob(siteType, scrape));
}
registry.add("CreateMissingBottles", createMissingBottles);
registry.add("UpdateBottleStats", updateBottleStats);
registry.add("UpdateCountryStats", updateCountryStats);
registry.add("UpdateEntityStats", updateEntityStats);
registry.add("UpdateRegionStats", updateRegionStats);
registry.add("VerifyBottleCreation", verifyBottleCreation);
registry.add("VerifyEntityCreation", verifyEntityCreation);
