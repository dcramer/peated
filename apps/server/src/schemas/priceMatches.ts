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
import { listResponse } from "./shared";
import { StorePriceSchema } from "./stores";

export const ExtractedBottleDetailsSchema = z.object({
  brand: z.string().nullable().default(null),
  expression: z.string().nullable().default(null),
  series: z.string().nullable().default(null),
  distillery: z.array(z.string()).nullable().default(null),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  abv: z.number().nullable().default(null),
  release_year: z.number().nullable().default(null),
  vintage_year: z.number().nullable().default(null),
  cask_type: z.string().nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().nullable().default(null),
});

export const PriceMatchCandidateSchema = z.object({
  bottleId: z.number().int(),
  alias: z.string().nullable().default(null),
  fullName: z.string(),
  brand: z.string().nullable().default(null),
  category: CategoryEnum.nullable().default(null),
  statedAge: z.number().min(0).max(100).nullable().default(null),
  edition: z.string().trim().nullable().default(null),
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
  releaseYear: z
    .number()
    .int()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  caskType: CaskTypeEnum.nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});

export const PriceMatchSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  description: z.string().nullable().default(null),
  extraSnippets: z.array(z.string()).default([]),
});

export const PriceMatchSearchEvidenceSchema = z.object({
  query: z.string(),
  results: z.array(PriceMatchSearchResultSchema).default([]),
});

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

const StorePriceMatchDecisionBaseSchema = z.object({
  confidence: z.number().min(0).max(100),
  rationale: z.string().nullable().default(null),
  candidateBottleIds: z.array(z.number().int()).default([]),
});

export const StorePriceMatchDecisionSchema = z.discriminatedUnion("action", [
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("match_existing"),
    suggestedBottleId: z.number().int(),
    proposedBottle: z.null().default(null),
  }),
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("correction"),
    suggestedBottleId: z.number().int(),
    proposedBottle: z.null().default(null),
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

export const StorePriceMatchAgentResponseSchema = z.object({
  decision: StorePriceMatchDecisionSchema,
});

export const StorePriceMatchProposalSchema = z.object({
  id: z.number(),
  status: StorePriceMatchProposalStatusEnum,
  proposalType: StorePriceMatchProposalTypeEnum,
  confidence: z.number().nullable(),
  currentBottleId: z.number().nullable(),
  suggestedBottleId: z.number().nullable(),
  candidateBottles: z.array(PriceMatchCandidateSchema),
  extractedLabel: ExtractedBottleDetailsSchema.nullable(),
  proposedBottle: ProposedBottleSchema.nullable(),
  searchEvidence: z.array(PriceMatchSearchEvidenceSchema),
  rationale: z.string().nullable(),
  model: z.string().nullable(),
  error: z.string().nullable(),
  lastEvaluatedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
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

export const StorePriceMatchQueueListResponse = listResponse(
  StorePriceMatchQueueItemSchema,
);
