// TODO: how can we automate registration here without importing the job code?
export type JobName =
  | "GenerateBottleDetails"
  | "GenerateCountryDetails"
  | "GenerateEntityDetails"
  | "GeocodeCountryLocation"
  | "GeocodeEntityLocation"
  | "IndexBottleSearchVectors"
  | "IndexEntitySearchVectors"
  | "NotifyDiscordOnTasting"
  | "OnBottleChange"
  | "OnEntityChange"
  | "ScrapeAstorWines"
  | "ScrapeHealthySpirits"
  | "ScrapeSMWS"
  | "ScrapeSMWSA"
  | "ScrapeTotalWine"
  | "ScrapeWoodenCork"
  | "ScrapeWhiskyAdvocate"
  | "CreateMissingBottles"
  | "UpdateBottleStats"
  | "UpdateCountryStats"
  | "UpdateEntityStats";
