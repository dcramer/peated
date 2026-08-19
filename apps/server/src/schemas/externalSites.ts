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
  itemCount: z.number().int().min(0).nullable(),
  error: z.string().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ExternalSiteHealthSchema = ExternalSiteSchema.extend({
  listingCount: z
    .number()
    .int()
    .min(0)
    .describe("Number of visible listings currently owned by the site"),
  latestRun: ExternalSiteRunSchema.nullable(),
  lastSucceededAt: z.string().datetime().nullable(),
});

export const ExternalReviewPublicationModeSchema = z.enum([
  "disabled",
  "review_only",
  "automatic",
]);

export const ExternalReviewSourcePolicySchema = z.object({
  externalSiteId: z.number().int().positive(),
  publicationMode: ExternalReviewPublicationModeSchema,
  allowFetching: z.boolean(),
  allowLlmProcessing: z.boolean(),
  allowScoreDisplay: z.boolean(),
  allowSummaryDisplay: z.boolean(),
  policyEvidenceUrl: z.string().url().nullable(),
  approvalReference: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  approvedByActorId: z.number().int().positive().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

const DisabledExternalReviewSourcePolicyInputSchema = z
  .object({
    publicationMode: z.literal("disabled"),
  })
  .strict();

const ApprovedExternalReviewSourcePolicyInputSchema = z
  .object({
    publicationMode: z.literal("review_only"),
    allowFetching: z.literal(true),
    allowLlmProcessing: z.boolean(),
    allowScoreDisplay: z.boolean(),
    allowSummaryDisplay: z.boolean(),
    policyEvidenceUrl: z.string().url(),
    approvalReference: z.string().trim().min(1).max(500),
    reviewedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (policy) => !policy.allowSummaryDisplay || policy.allowLlmProcessing,
    {
      message: "Summary display requires LLM processing permission.",
      path: ["allowSummaryDisplay"],
    },
  );

export const ExternalReviewSourcePolicyInputSchema = z.discriminatedUnion(
  "publicationMode",
  [
    DisabledExternalReviewSourcePolicyInputSchema,
    ApprovedExternalReviewSourcePolicyInputSchema,
  ],
);
