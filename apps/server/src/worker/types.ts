import { z } from "zod";

export type JobName =
  | "ResolveAuctionLot"
  | "ApplyAuctionLotMatch"
  | "CapturePriceImage"
  | "CleanupPendingUploads"
  | "CleanupWrongPhotoMatchPhotos"
  | "GenerateCountryDetails"
  | "GenerateEntityDetails"
  | "GenerateEntityPronunciationAudio"
  | "GenerateRegionDetails"
  | "WriteEntityAbout"
  | "GeocodeCountryLocation"
  | "GeocodeRegionLocation"
  | "GeocodeEntityLocation"
  | "IdentifyTastingDraft"
  | "IndexBottleReference"
  | "IndexBottleSearch"
  | "IndexBottleSeriesSearch"
  | "IndexEntitySearch"
  | "MergeEntity"
  | "NotifyReport"
  | "OnBottleChange"
  | "OnBottleReferenceChange"
  | "OnEntityChange"
  | "ProcessAccountDeletions"
  | "ProcessStorePriceMatchRetryRun"
  | "ProcessNotification"
  | "RepairBottleGroupBottleCounts"
  | "RepairBottleStats"
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
  | "UpdateExternalReviews"
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

export type JobFunction<TResult = void> = (
  args?: JobPayload,
  context?: JobContext,
) => Promise<TResult>;

export type JobArgs = JobPayload;
