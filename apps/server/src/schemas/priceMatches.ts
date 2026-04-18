import { DEFAULT_BOTTLE_CREATION_TARGET } from "@peated/bottle-classifier/releaseIdentity";
import { z } from "zod";
import { CATEGORY_LIST } from "../constants";
import {
  BottleReleaseInputSchema,
  BottleReleaseSchema,
} from "./bottleReleases";
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

export const PriceMatchCandidateSchema = z.object({
  kind: z
    .enum(["bottle", "release"])
    .optional()
    .describe(
      "Internal candidate discriminator: `bottle` means a parent bottle candidate and `release` means a child bottle_release candidate.",
    ),
  bottleId: z.number().int(),
  releaseId: z.number().int().nullable().optional(),
  alias: z.string().nullable().default(null),
  fullName: z.string(),
  bottleFullName: z.string().nullable().optional(),
  brand: z.string().nullable().default(null),
  bottler: z.string().nullable().default(null),
  series: z.string().nullable().default(null),
  distillery: z.array(z.string()).default([]),
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
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});
export const BottleCandidateSchema = PriceMatchCandidateSchema;

export const PriceMatchSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  extraSnippets: z.array(z.string()).default([]),
});
export const BottleSearchResultSchema = PriceMatchSearchResultSchema;

export const PriceMatchSearchEvidenceSchema = z.object({
  provider: z.enum(["openai", "brave"]).default("openai"),
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

export const PriceMatchEvidenceSourceTierEnum = z.enum([
  "official",
  "critic",
  "retailer",
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

export const StorePriceMatchAutomationAssessmentSchema = z.object({
  modelConfidence: z.number().nullable(),
  automationScore: z.number().nullable(),
  automationEligible: z.boolean().default(false),
  automationBlockers: z.array(z.string()).default([]),
  decisiveMatchAttributes: z.array(PriceMatchAttributeEnum).default([]),
  differentiatingAttributes: z.array(PriceMatchAttributeEnum).default([]),
  webEvidenceChecks: z.array(PriceMatchEvidenceCheckSchema).default([]),
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
export const PriceMatchCreationTargetEnum = z.enum([
  "bottle",
  "release",
  "bottle_and_release",
]);
export const BottleCreationTargetEnum = PriceMatchCreationTargetEnum;

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

export const ProposedReleaseSchema = BottleReleaseInputSchema.omit({
  image: true,
});

const AgentProposedBottleSchema = ProposedBottleSchema.extend({
  abv: z.number().nullable().default(null),
});

const AgentProposedReleaseSchema = ProposedReleaseSchema.extend({
  abv: z.number().nullable().default(null),
});

function validateCreateNewDecisionShape(
  value: {
    creationTarget?: z.infer<typeof PriceMatchCreationTargetEnum> | null;
    parentBottleId?: number | null;
    proposedBottle?: z.infer<typeof ProposedBottleSchema> | null;
    proposedRelease?: z.infer<typeof ProposedReleaseSchema> | null;
  },
  ctx: z.RefinementCtx,
) {
  const creationTarget = value.creationTarget ?? DEFAULT_BOTTLE_CREATION_TARGET;
  const parentBottleId = value.parentBottleId ?? null;
  const proposedRelease = value.proposedRelease ?? null;

  if (creationTarget === "bottle") {
    if (!value.proposedBottle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedBottle"],
        message: "Bottle creation requires a proposed bottle.",
      });
    }
    if (parentBottleId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentBottleId"],
        message: "Bottle-only creation cannot include a parent bottle.",
      });
    }
    if (proposedRelease) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelease"],
        message: "Bottle-only creation cannot include a proposed release.",
      });
    }
    return;
  }

  if (creationTarget === "release") {
    if (!parentBottleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentBottleId"],
        message: "Release creation requires a parent bottle.",
      });
    }
    if (!proposedRelease) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelease"],
        message: "Release creation requires a proposed release.",
      });
    }
    if (value.proposedBottle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedBottle"],
        message: "Release-only creation cannot include a proposed bottle.",
      });
    }
    return;
  }

  if (!value.proposedBottle) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["proposedBottle"],
      message: "Bottle-and-release creation requires a proposed bottle.",
    });
  }
  if (!proposedRelease) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["proposedRelease"],
      message: "Bottle-and-release creation requires a proposed release.",
    });
  }
  if (parentBottleId !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parentBottleId"],
      message:
        "Bottle-and-release creation cannot point at an existing parent bottle.",
    });
  }
}

const StorePriceMatchDecisionBaseSchema = z.object({
  confidence: z.number().min(0).max(100),
  rationale: z.string().nullable().default(null),
  candidateBottleIds: z.array(z.number().int()).default([]),
});

const StorePriceMatchCreateNewDecisionSchema =
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("create_new"),
    suggestedBottleId: z.null().default(null),
    suggestedReleaseId: z.null().optional(),
    parentBottleId: z.number().int().nullable().optional(),
    creationTarget: PriceMatchCreationTargetEnum.optional(),
    proposedBottle: ProposedBottleSchema.nullable().default(null),
    proposedRelease: ProposedReleaseSchema.nullable().optional(),
  }).superRefine(validateCreateNewDecisionShape);

export const StorePriceMatchDecisionSchema = z.discriminatedUnion("action", [
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("match_existing"),
    suggestedBottleId: z.number().int(),
    suggestedReleaseId: z.number().int().nullable().optional(),
    parentBottleId: z.null().optional(),
    creationTarget: z.null().optional(),
    proposedBottle: z.null().default(null),
    proposedRelease: z.null().optional(),
  }),
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("correction"),
    suggestedBottleId: z.number().int(),
    suggestedReleaseId: z.number().int().nullable().optional(),
    parentBottleId: z.null().optional(),
    creationTarget: z.null().optional(),
    proposedBottle: ProposedBottleSchema.nullable().default(null),
    proposedRelease: z.null().optional(),
  }),
  StorePriceMatchCreateNewDecisionSchema,
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.literal("no_match"),
    suggestedBottleId: z.null().default(null),
    suggestedReleaseId: z.null().optional(),
    parentBottleId: z.null().optional(),
    creationTarget: z.null().optional(),
    proposedBottle: z.null().default(null),
    proposedRelease: z.null().optional(),
  }),
]);
export const BottleClassificationDecisionSchema = StorePriceMatchDecisionSchema;

export const StorePriceMatchAgentDecisionSchema =
  StorePriceMatchDecisionBaseSchema.extend({
    action: z.enum(["match_existing", "correction", "create_new", "no_match"]),
    suggestedBottleId: z.number().int().nullable().default(null),
    suggestedReleaseId: z.number().int().nullable().default(null),
    parentBottleId: z.number().int().nullable().default(null),
    creationTarget: PriceMatchCreationTargetEnum.nullable().default(null),
    proposedBottle: AgentProposedBottleSchema.nullable().default(null),
    proposedRelease: AgentProposedReleaseSchema.nullable().default(null),
  });
export const BottleClassifierAgentDecisionSchema =
  StorePriceMatchAgentDecisionSchema;

export const StorePriceMatchAgentResponseSchema = z.object({
  decision: StorePriceMatchAgentDecisionSchema,
});
export const BottleClassifierAgentResponseSchema =
  StorePriceMatchAgentResponseSchema;

export const StorePriceMatchProposalSchema = z.object({
  id: z.number(),
  status: StorePriceMatchProposalStatusEnum,
  proposalType: StorePriceMatchProposalTypeEnum,
  confidence: z.number().nullable(),
  modelConfidence:
    StorePriceMatchAutomationAssessmentSchema.shape.modelConfidence,
  automationScore:
    StorePriceMatchAutomationAssessmentSchema.shape.automationScore,
  automationEligible:
    StorePriceMatchAutomationAssessmentSchema.shape.automationEligible,
  automationBlockers:
    StorePriceMatchAutomationAssessmentSchema.shape.automationBlockers,
  decisiveMatchAttributes:
    StorePriceMatchAutomationAssessmentSchema.shape.decisiveMatchAttributes,
  differentiatingAttributes:
    StorePriceMatchAutomationAssessmentSchema.shape.differentiatingAttributes,
  webEvidenceChecks:
    StorePriceMatchAutomationAssessmentSchema.shape.webEvidenceChecks,
  currentBottleId: z.number().nullable(),
  currentReleaseId: z.number().nullable(),
  suggestedBottleId: z.number().nullable(),
  suggestedReleaseId: z.number().nullable(),
  parentBottleId: z.number().nullable(),
  creationTarget: PriceMatchCreationTargetEnum.nullable(),
  candidateBottles: z.array(PriceMatchCandidateSchema),
  extractedLabel: ExtractedBottleDetailsSchema.nullable(),
  proposedBottle: ProposedBottleSchema.nullable(),
  proposedRelease: ProposedReleaseSchema.nullable(),
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
    currentRelease: BottleReleaseSchema.nullable(),
    suggestedBottle: BottleSchema.nullable(),
    suggestedRelease: BottleReleaseSchema.nullable(),
    parentBottle: BottleSchema.nullable(),
  });

export const StorePriceMatchQueueListResponse = z.object({
  results: z.array(StorePriceMatchQueueItemSchema),
  rel: CursorSchema,
  stats: z.object({
    actionableCount: z.number().int().min(0),
    processingCount: z.number().int().min(0),
  }),
});
