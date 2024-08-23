// TODO: how can we automate registration here without importing the job code?
export type JobName =
  | "CapturePriceImage"
  | "GenerateBottleDetails"
  | "GenerateCountryDetails"
  | "GenerateEntityDetails"
  | "GenerateRegionDetails"
  | "GeocodeCountryLocation"
  | "GeocodeRegionLocation"
  | "GeocodeEntityLocation"
  | "IndexBottleAlias"
  | "IndexBottleSearchVectors"
  | "IndexEntitySearchVectors"
  | "MergeBottle"
  | "MergeEntity"
  | "NotifyDiscordOnTasting"
  | "OnBottleChange"
  | "OnBottleAliasChange"
  | "OnEntityChange"
  | "ProcessNotification"
  | "ScrapeAstorWines"
  | "ScrapeHealthySpirits"
  | "ScrapeReserveBar"
  | "ScrapeSMWS"
  | "ScrapeSMWSA"
  | "ScrapeTotalWine"
  | "ScrapeWoodenCork"
  | "ScrapeWhiskyAdvocate"
  | "CreateMissingBottles"
  | "UpdateBottleStats"
  | "UpdateCountryStats"
  | "UpdateEntityStats"
  | "UpdateRegionStats";

type TraceContext = {
  "sentry-trace"?: string;
  baggage?: any;
};

type JobContext = { traceContext?: TraceContext };

export type JobFunction = (
  args?: any,
  context?: JobContext,
) => Promise<unknown>;
