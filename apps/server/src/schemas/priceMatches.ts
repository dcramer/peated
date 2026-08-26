import { BottleCandidateSchema as ClassifierBottleCandidateSchema } from "@peated/bottle-classifier/internal/types";
import { z } from "zod";
import { CATEGORY_LIST } from "../constants";
import { BottleSchema } from "./bottles";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
} from "./common";
import { ExternalSiteSchema } from "./externalSites";
import { CursorSchema } from "./shared";
import { StorePriceSchema } from "./stores";

const AliasScopeEnum = z.enum(["global_alias", "none"]);

export const ExtractedBottleDetailsSchema = z.object({
  brand: z.string().nullable().default(null),
  bottler: z.string().nullable().default(null),
  expression: z.string().nullable().default(null),
  series: z.string().nullable().default(null),
  distillery: z.array(z.string()).nullable().default(null),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  abv: z.number().nullable().default(null),
  release_year: z.number().nullable().default(null),
  vintage_year: z.number().nullable().default(null),
  cask_type: z.string().nullable().default(null),
  cask_size: CaskSizeEnum.nullable().default(null),
  cask_fill: CaskFillEnum.nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().nullable().default(null),
});
export const BottleReferenceIdentitySchema = ExtractedBottleDetailsSchema;

export const PriceMatchCandidateSchema = ClassifierBottleCandidateSchema;
export const BottleCandidateSchema = ClassifierBottleCandidateSchema;

export const PriceMatchSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  extraSnippets: z.array(z.string()).default([]),
});
export const BottleSearchResultSchema = PriceMatchSearchResultSchema;

export const PriceMatchSearchEvidenceSchema = z.object({
  // Legacy proposals may contain Brave evidence; runtime no longer writes it.
  provider: z
    .enum(["openai", "firecrawl", "brave"])
    .default("openai")
    .transform((provider) => (provider === "brave" ? "openai" : provider)),
  query: z.string(),
  summary: z.string().nullable().default(null),
  results: z.array(PriceMatchSearchResultSchema).default([]),
});
export const BottleSearchEvidenceSchema = PriceMatchSearchEvidenceSchema;

export const PriceMatchAttributeEnum = z.enum([
  "brand",
  "bottler",
  "name",
  "series",
  "distillery",
  "category",
  "statedAge",
  "edition",
  "caskType",
  "caskSize",
  "caskFill",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
]);

// Legacy checks may contain official, critic, retailer, or unknown. Current
// code only writes external or origin_retailer.
export const PriceMatchEvidenceSourceTierEnum = z.enum([
  "official",
  "critic",
  "retailer",
  "external",
  "origin_retailer",
  "unknown",
]);
export const BottleEvidenceSourceTierEnum = PriceMatchEvidenceSourceTierEnum;

export const PriceMatchEvidenceCheckSchema = z.object({
  attribute: PriceMatchAttributeEnum,
  expectedValue: z.string(),
  required: z.boolean().default(false),
  validated: z.boolean().default(false),
  weaklySupported: z.boolean().default(false),
  matchedSourceTiers: z.array(PriceMatchEvidenceSourceTierEnum).default([]),
  matchedSourceUrls: z.array(z.string().url()).default([]),
});
export const BottleEvidenceCheckSchema = PriceMatchEvidenceCheckSchema;

export const StorePriceMatchAutomationAssessmentFields = {
  modelConfidence: z.number().nullable(),
  automationScore: z.number().nullable(),
  automationEligible: z.boolean().default(false),
  automationBlockers: z.array(z.string()).default([]),
  decisiveMatchAttributes: z.array(PriceMatchAttributeEnum).default([]),
  structuredMatchRequiresStatedAge: z.boolean().default(false),
  plainAgeBottleAutoVerifyEligible: z.boolean().default(false),
  differentiatingAttributes: z.array(PriceMatchAttributeEnum).default([]),
  webEvidenceChecks: z.array(PriceMatchEvidenceCheckSchema).default([]),
} as const;

export const StorePriceMatchAutomationAssessmentSchema = z.object(
  StorePriceMatchAutomationAssessmentFields,
);

export type StorePriceMatchAutomationAssessment = z.infer<
  typeof StorePriceMatchAutomationAssessmentSchema
>;

export const StorePriceMatchProposalStatusEnum = z.enum([
  "verified",
  "pending_review",
  "approved",
  "ignored",
  "errored",
]);

export const StorePriceMatchProposalTypeEnum = z.enum([
  "match_existing",
  "create_new",
  "correction",
  "no_match",
]);
export const BottleIdentityScopeEnum = z.enum(["product", "exact_cask"]);

export const StorePriceMatchQueueStateEnum = z.enum([
  "actionable",
  "processing",
]);

export const ProposedEntityChoiceSchema = z.object({
  id: z.number().int().nullable().default(null),
  name: z.string().trim().min(1),
});

export const ProposedSeriesChoiceSchema = z.object({
  id: z.number().int().nullable().default(null),
  name: z.string().trim().min(1),
});

export const ProposedBottleSchema = z.object({
  name: z.string().trim().min(1),
  series: ProposedSeriesChoiceSchema.nullable().default(null),
  category: CategoryEnum.nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  statedAge: z.number().int().min(0).max(100).nullable().default(null),
  caskStrength: z.boolean().nullable().default(null),
  singleCask: z.boolean().nullable().default(null),
  abv: z.number().min(0).max(100).nullable().default(null),
  vintageYear: z
    .number()
    .int()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  bottlingYear: z
    .number()
    .int()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  releaseYear: z
    .number()
    .int()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
  brand: ProposedEntityChoiceSchema,
  distillers: z.array(ProposedEntityChoiceSchema).default([]),
  bottler: ProposedEntityChoiceSchema.nullable().default(null),
});

export const StorePriceBottleRepairDraftSchema = ProposedBottleSchema;

const StorePriceMatchDecisionBaseSchema = z
  .object({
    // Numeric confidence was removed from the classifier agent contract; this
    // field is retained as nullable telemetry and is written null.
    confidence: z.number().min(0).max(100).nullable().default(null),
    rationale: z.string().nullable().default(null),
    candidateBottleIds: z.array(z.number().int()).default([]),
    identityScope: BottleIdentityScopeEnum.default("product"),
    aliasScope: AliasScopeEnum.optional(),
  })
  .strict();

export const StorePriceMatchDecisionSchema = z.discriminatedUnion("action", [
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("match_existing"),
    suggestedBottleId: z.number().int(),
    proposedBottle: z.null().default(null),
  }),
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("correction"),
    suggestedBottleId: z.number().int(),
    proposedBottle: StorePriceBottleRepairDraftSchema.nullable().default(null),
  }),
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("create_new"),
    suggestedBottleId: z.null().default(null),
    proposedBottle: ProposedBottleSchema,
  }),
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("no_match"),
    suggestedBottleId: z.null().default(null),
    proposedBottle: z.null().default(null),
  }),
]);

export const StorePriceMatchProposalSchema = z.object({
  id: z.number(),
  status: StorePriceMatchProposalStatusEnum,
  proposalType: StorePriceMatchProposalTypeEnum,
  confidence: z.number().nullable(),
  modelConfidence: StorePriceMatchAutomationAssessmentFields.modelConfidence,
  automationScore: StorePriceMatchAutomationAssessmentFields.automationScore,
  automationEligible:
    StorePriceMatchAutomationAssessmentFields.automationEligible,
  automationBlockers:
    StorePriceMatchAutomationAssessmentFields.automationBlockers,
  decisiveMatchAttributes:
    StorePriceMatchAutomationAssessmentFields.decisiveMatchAttributes,
  plainAgeBottleAutoVerifyEligible:
    StorePriceMatchAutomationAssessmentFields.plainAgeBottleAutoVerifyEligible,
  differentiatingAttributes:
    StorePriceMatchAutomationAssessmentFields.differentiatingAttributes,
  webEvidenceChecks:
    StorePriceMatchAutomationAssessmentFields.webEvidenceChecks,
  candidateBottles: z.array(PriceMatchCandidateSchema),
  extractedLabel: ExtractedBottleDetailsSchema.nullable(),
  proposedBottle: ProposedBottleSchema.nullable(),
  searchEvidence: z.array(PriceMatchSearchEvidenceSchema),
  rationale: z.string().nullable(),
  model: z.string().nullable(),
  error: z.string().nullable(),
  lastEvaluatedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  isProcessing: z.boolean(),
  processingQueuedAt: z.string().datetime().nullable(),
  processingExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StorePriceMatchQueueItemSchema =
  StorePriceMatchProposalSchema.extend({
    price: StorePriceSchema.extend({
      site: ExternalSiteSchema,
    }),
    currentBottle: BottleSchema.nullable(),
    suggestedBottle: BottleSchema.nullable(),
  });

export const StorePriceMatchQueueListResponse = z.object({
  results: z.array(StorePriceMatchQueueItemSchema),
  rel: CursorSchema,
  stats: z.object({
    actionableCount: z.number().int().min(0),
    processingCount: z.number().int().min(0),
  }),
});
