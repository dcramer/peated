import { z } from "zod";

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
  | "IndexBottleReference"
  | "IndexBottleSearchVectors"
  | "IndexBottleSeriesSearchVectors"
  | "IndexEntitySearchVectors"
  | "MergeEntity"
  | "NotifyDiscordOnTasting"
  | "OnBottleChange"
  | "OnBottleReferenceChange"
  | "OnEntityChange"
  | "ProcessStorePriceMatchRetryRun"
  | "ProcessNotification"
  | "RepairBottleGroupBottleCounts"
  | "RepairBottleSeriesReleaseCounts"
  | "RepairCollectionBottleCounts"
  | "RepairEntityBottleCounts"
  | "RepairLocationBottleCounts"
  | "ReconcileStorePriceMatchProposals"
  | "ResolveStorePriceBottle"
  | "RunScraper"
  | "CreateMissingBottles"
  | "UpdateBottleStats"
  | "UpdateSiteReviewScores"
  | "UpdateCountryStats"
  | "UpdateEntityStats"
  | "UpdateRegionStats"
  | "VerifyBottleCreation"
  | "VerifyEntityCreation";

export type JobPayloadValue =
  | boolean
  | JobPayloadValue[]
  | null
  | number
  | string
  | { [key: string]: JobPayloadValue | undefined };

export type JobPayload =
  | { [key: string]: JobPayloadValue | undefined }
  | undefined;

export type QueuedJobInput = {
  [key: string]: JobPayloadValue | undefined;
};

const TraceContextSchema = z
  .object({
    "sentry-trace": z.string().optional(),
    baggage: z.string().optional(),
  })
  .passthrough();

const JobActorContextSchema = z.object({
  type: z.literal("user"),
  userId: z.number().int().positive(),
});

export const JobContextSchema = z
  .object({
    traceContext: TraceContextSchema.optional(),
    actor: JobActorContextSchema.optional(),
  })
  .strict();

export type JobActorContext = z.infer<typeof JobActorContextSchema>;
export type JobContext = z.infer<typeof JobContextSchema>;

/** Parse queued job context, dropping malformed trace or actor attribution. */
export function parseJobContext(input: JobPayload | null): JobContext {
  const result = JobContextSchema.safeParse(input);
  return result.success ? result.data : {};
}

export type JobFunction<TResult = void> = (
  args?: JobPayload,
  context?: JobContext,
) => Promise<TResult>;

export type JobArgs = JobPayload;
