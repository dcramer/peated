import { z } from "zod";
import { EXTERNAL_SITE_TYPE_LIST } from "../constants";

export const ExternalSiteTypeEnum = z.enum(EXTERNAL_SITE_TYPE_LIST);

export const ExternalSiteSchema = z.object({
  id: z.number().describe("Unique identifier for the external site"),
  type: ExternalSiteTypeEnum.describe("Type of external site"),
  name: z.string().describe("Name of the external site"),
  lastRunAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Completion timestamp of the latest terminal scraper run"),
  nextRunAt: z
    .string()
    .datetime()
    .nullable()
    .describe("Timestamp of the next scheduled run"),
  runEvery: z.number().nullable().describe("Interval in minutes between runs"),
});

export const ExternalSiteRunSchema = z.object({
  id: z.number().describe("Unique identifier for this scraper run"),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  trigger: z.enum(["scheduled", "manual"]),
  requestedById: z.number().nullable(),
  attemptCount: z.number().int().min(0),
  requestLimit: z.number().int().positive(),
  sliceRequestCount: z.number().int().min(0),
  requestCount: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  rateLimitCount: z.number().int().min(0),
  emittedItemCount: z.number().int().min(0),
  itemCount: z.number().int().min(0).nullable(),
  error: z.string().nullable(),
  nextAttemptAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ExternalReviewPublicationModeSchema = z.enum([
  "disabled",
  "review_only",
  "automatic",
]);

export const ExternalReviewSourcePolicySchema = z.object({
  externalSiteId: z.number().int().positive(),
  publicationMode: ExternalReviewPublicationModeSchema,
  allowLlmProcessing: z.boolean(),
  allowScoreDisplay: z.boolean(),
  allowSummaryDisplay: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
});

export const ExternalSiteItemCoverageSchema = z.object({
  total: z.number().int().min(0),
  matched: z.number().int().min(0),
  unmatched: z.number().int().min(0),
});

export const ExternalSiteScrapeOriginSchema = z.object({
  origin: z.string().url(),
  robotsMode: z.enum(["enforce", "not_applicable"]),
  robotsStatus: z.enum(["unknown", "missing", "rules", "not_applicable"]),
  robotsFetchedAt: z.string().datetime().nullable(),
  robotsExpiresAt: z.string().datetime().nullable(),
});

export const ExternalSiteScrapeTargetSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  blockedUntil: z.string().datetime().nullable(),
  coolingDown: z.boolean(),
  minimumSpacingMs: z.number().int().min(0),
  requestsPerWindow: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  origins: z.array(ExternalSiteScrapeOriginSchema),
});

export const ExternalSiteHealthSchema = ExternalSiteSchema.extend({
  reviews: ExternalSiteItemCoverageSchema,
  priceListings: ExternalSiteItemCoverageSchema,
  latestRun: ExternalSiteRunSchema.nullable(),
  lastSucceededAt: z.string().datetime().nullable(),
  runtime: z.object({
    registered: z.boolean(),
    targetKeys: z.array(z.string()),
    targets: z.array(ExternalSiteScrapeTargetSchema),
  }),
  reviewPolicy: ExternalReviewSourcePolicySchema.nullable(),
});

const DisabledExternalReviewSourcePolicyInputSchema = z
  .object({
    publicationMode: z.literal("disabled"),
  })
  .strict();

const EnabledExternalReviewSourcePolicyInputSchema = z
  .object({
    publicationMode: z.enum(["review_only", "automatic"]),
    allowLlmProcessing: z.boolean(),
    allowScoreDisplay: z.boolean(),
    allowSummaryDisplay: z.boolean(),
  })
  .strict()
  .refine(
    (policy) => !policy.allowSummaryDisplay || policy.allowLlmProcessing,
    {
      message: "Summary display requires the LLM processing capability.",
      path: ["allowSummaryDisplay"],
    },
  );

export const ExternalReviewSourcePolicyInputSchema = z.discriminatedUnion(
  "publicationMode",
  [
    DisabledExternalReviewSourcePolicyInputSchema,
    EnabledExternalReviewSourcePolicyInputSchema,
  ],
);
