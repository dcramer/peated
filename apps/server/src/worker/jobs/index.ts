import type { JobFunction } from "faktory-worker";
import createMissingBottles from "./createMissingBottles";
import generateBottleDetails from "./generateBottleDetails";
import generateEntityDetails from "./generateEntityDetails";
import geocodeCountryLocation from "./geocodeCountryLocation";
import geocodeEntityLocation from "./geocodeEntityLocation";
import indexBottleSearchVectors from "./indexBottleSearchVectors";
import indexEntitySearchVectors from "./indexEntitySearchVectors";
import notifyDiscordOnTasting from "./notifyDiscordOnTasting";
import onBottleChange from "./onBottleChange";
import onEntityChange from "./onEntityChange";
import scrapeAstorWines from "./scrapeAstorWines";
import scrapeHealthySpirits from "./scrapeHealthySpirits";
import scrapeSMWS from "./scrapeSMWS";
import scrapeSMWSA from "./scrapeSMWSA";
import scrapeTotalWine from "./scrapeTotalWine";
import scrapeWhiskeyAdvocate from "./scrapeWhiskyAdvocate";
import scrapeWoodenCork from "./scrapeWoodenCork";
import { registerJob, runJob } from "./utils";

// faktory does not have correct types
registerJob("GenerateBottleDetails", generateBottleDetails as JobFunction);
registerJob("GenerateEntityDetails", generateEntityDetails as JobFunction);
registerJob("GeocodeCountryLocation", geocodeCountryLocation as JobFunction);
registerJob("GeocodeEntityLocation", geocodeEntityLocation as JobFunction);
registerJob(
  "IndexBottleSearchVectors",
  indexBottleSearchVectors as JobFunction,
);
registerJob(
  "IndexEntitySearchVectors",
  indexEntitySearchVectors as JobFunction,
);
registerJob("NotifyDiscordOnTasting", notifyDiscordOnTasting as JobFunction);
registerJob("OnBottleChange", onBottleChange as JobFunction);
registerJob("OnEntityChange", onEntityChange as JobFunction);
registerJob("ScrapeAstorWines", scrapeAstorWines);
registerJob("ScrapeHealthySpirits", scrapeHealthySpirits);
registerJob("ScrapeSMWS", scrapeSMWS);
registerJob("ScrapeSMWSA", scrapeSMWSA);
registerJob("ScrapeTotalWine", scrapeTotalWine);
registerJob("ScrapeWoodenCork", scrapeWoodenCork);
registerJob("ScrapeWhiskyAdvocate", scrapeWhiskeyAdvocate);
registerJob("CreateMissingBottles", createMissingBottles);

export { registerJob, runJob };
