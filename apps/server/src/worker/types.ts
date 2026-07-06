import { z } from "zod";

// TODO: how can we automate registration here without importing the job code?
export type JobName =
  | "CapturePriceImage"
  | "CleanupPendingUploads"
  | "GenerateBottleDetails"
  | "GenerateCountryDetails"
  | "GenerateEntityDetails"
  | "GenerateRegionDetails"
  | "GeocodeCountryLocation"
  | "GeocodeRegionLocation"
  | "GeocodeEntityLocation"
  | "IndexBottleAlias"
  | "IndexBottleSearchVectors"
  | "IndexBottleReleaseSearchVectors"
  | "IndexBottleSeriesSearchVectors"
  | "IndexEntitySearchVectors"
  | "MergeBottle"
  | "MergeEntity"
  | "NotifyDiscordOnTasting"
  | "OnBottleChange"
  | "OnBottleReleaseChange"
  | "OnBottleAliasChange"
  | "OnEntityChange"
  | "ProcessStorePriceMatchRetryRun"
  | "ProcessNotification"
  | "ReconcileStorePriceMatchProposals"
  | "ResolveStorePriceBottle"
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
  | "UpdateRegionStats"
  | "VerifyBottleCreation"
  | "VerifyEntityCreation";

const TraceContextSchema = z
  .object({
    "sentry-trace": z.string().optional(),
    baggage: z.string().optional(),
  })
  .passthrough();

const JobActorContextSchema = z.object({
  type: z.literal("user"),
  userId: z.number().int().positive(),
  username: z.string().optional(),
});

const JobContextSchema = z
  .object({
    traceContext: TraceContextSchema.optional(),
    actor: JobActorContextSchema.optional(),
  })
  .strict();

export type JobActorContext = z.infer<typeof JobActorContextSchema>;
export type JobContext = z.infer<typeof JobContextSchema>;

/** Parse queued job context, dropping malformed trace or actor attribution. */
export function parseJobContext(input: unknown): JobContext {
  const result = JobContextSchema.safeParse(input);
  return result.success ? result.data : {};
}

export type JobFunction = (
  args?: any,
  context?: JobContext,
) => Promise<unknown>;
