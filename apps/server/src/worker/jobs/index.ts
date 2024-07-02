import type { JobFunction } from "faktory-worker";
import faktory from "faktory-worker";
import createMissingBottles from "./createMissingBottles";
import generateBottleDetails from "./generateBottleDetails";
import generateCountryDetails from "./generateCountryDetails";
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
import { type JobName } from "./types";
import updateBottleStats from "./updateBottleStats";
import updateCountryStats from "./updateCountryStats";
import updateEntityStats from "./updateEntityStats";
import { registerJob } from "./utils";

// faktory does not have correct types
registerJob("GenerateBottleDetails", generateBottleDetails as JobFunction);
registerJob("GenerateCountryDetails", generateCountryDetails as JobFunction);
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
registerJob("UpdateBottleStats", updateBottleStats as JobFunction);
registerJob("UpdateCountryStats", updateCountryStats as JobFunction);
registerJob("UpdateEntityStats", updateEntityStats as JobFunction);

export async function runJob(jobName: JobName, args?: any) {
  const jobFn = faktory.registry[jobName];
  if (!jobFn) throw new Error(`Unknown job: ${jobName}`);
  return await jobFn(args);
}

export { registerJob };
