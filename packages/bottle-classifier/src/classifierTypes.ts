import { z } from "zod";

const createTuple = <T extends Readonly<{ id: string }[]>>(arr: T) =>
  arr.map((s) => s.id) as {
    [K in keyof T]: T[K] extends { id: infer U } ? U : never;
  };

export const CATEGORY_LIST = [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "single_pot_still",
  "spirit",
] as const;

export const ENTITY_TYPE_LIST = ["brand", "bottler", "distiller"] as const;

export const CASK_FILLS = ["1st_fill", "2nd_fill", "refill", "other"] as const;

export const CASK_TYPES = [
  { id: "bourbon", category: "whisky" },
  { id: "amontilado", category: "sherry" },
  { id: "fino", category: "sherry" },
  { id: "manzanilla", category: "sherry" },
  { id: "oloroso", category: "sherry" },
  { id: "palo_cortado", category: "sherry" },
  { id: "pedro_ximenez", category: "sherry", shortName: "px" },
  { id: "liqueur_muscat", category: "fortified_wine" },
  { id: "madeira", category: "fortified_wine" },
  { id: "marsala", category: "fortified_wine" },
  { id: "tawny_port", category: "fortified_wine" },
  { id: "ruby_port", category: "fortified_wine" },
  { id: "rose_port", category: "fortified_wine" },
  { id: "white_port", category: "fortified_wine" },
  { id: "amarone", category: "wine" },
  { id: "barolo", category: "wine" },
  { id: "bordeaux", category: "wine" },
  { id: "burgundy", category: "wine" },
  { id: "chardonnay", category: "wine" },
  { id: "muscat", category: "wine" },
  { id: "sauternes", category: "wine" },
  { id: "tokaji", category: "wine" },
  { id: "rum_white", category: "rum" },
  { id: "rum_dark", category: "rum" },
  { id: "cognac", category: "cognac" },
  { id: "oak", category: "wood" },
  { id: "other", category: "other" },
] as const;

export const CASK_TYPE_IDS = createTuple(CASK_TYPES);

export const CASK_SIZES = [
  { id: "quarter_cask", size: [45, 50] },
  { id: "barrel", size: [190, 200] },
  { id: "hogshead", size: [225, 250] },
  { id: "barrique", size: [225, 300] },
  { id: "puncheon", size: [450, 500] },
  { id: "butt", size: [475, 500] },
  { id: "port_pipe", size: [550, 650] },
  { id: "madeira_drum", size: [600, 650] },
] as const;

export const CASK_SIZE_IDS = createTuple(CASK_SIZES);

export const CaskFillEnum = z.enum(CASK_FILLS);
export const CaskTypeEnum = z.enum(CASK_TYPE_IDS);
export const CaskSizeEnum = z.enum(CASK_SIZE_IDS);
export const CategoryEnum = z.enum(CATEGORY_LIST);
export const EntityTypeEnum = z.enum(ENTITY_TYPE_LIST);

const CURRENT_YEAR = new Date().getFullYear();

export const BottleExtractedDetailsSchema = z.object({
  brand: z.string().nullable().default(null),
  bottler: z.string().nullable().default(null),
  expression: z.string().nullable().default(null),
  series: z.string().nullable().default(null),
  distillery: z.array(z.string()).nullable().default(null),
  category: CategoryEnum.nullable().default(null),
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

export const BottleCandidateSchema = z.object({
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
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  releaseYear: z
    .number()
    .int()
    .gte(1800)
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});

export const BottleSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  extraSnippets: z.array(z.string()).default([]),
});

export const BottleSearchEvidenceSchema = z.object({
  provider: z.enum(["openai", "brave"]).default("openai"),
  query: z.string(),
  summary: z.string().nullable().default(null),
  results: z.array(BottleSearchResultSchema).default([]),
});

export const BottleEvidenceSourceTierEnum = z.enum([
  "official",
  "critic",
  "retailer",
  "origin_retailer",
  "unknown",
]);

export const BottleEvidenceCheckSchema = z.object({
  attribute: z.enum([
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
  ]),
  expectedValue: z.string(),
  required: z.boolean().default(false),
  validated: z.boolean().default(false),
  weaklySupported: z.boolean().default(false),
  matchedSourceTiers: z.array(BottleEvidenceSourceTierEnum).default([]),
  matchedSourceUrls: z.array(z.string().url()).default([]),
});

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
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  releaseYear: z
    .number()
    .int()
    .gte(1800)
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
  brand: ProposedEntityChoiceSchema,
  distillers: z.array(ProposedEntityChoiceSchema).default([]),
  bottler: ProposedEntityChoiceSchema.nullable().default(null),
});

export const ProposedReleaseSchema = z.object({
  edition: z.string().nullable().default(null),
  statedAge: z.number().nullable().default(null),
  abv: z.number().min(0).max(100).nullable().default(null),
  caskStrength: z.boolean().nullable().default(null),
  singleCask: z.boolean().nullable().default(null),
  vintageYear: z
    .number()
    .gte(1800)
    .lte(CURRENT_YEAR + 1)
    .nullable()
    .default(null),
  releaseYear: z
    .number()
    .gte(1800)
    .lte(CURRENT_YEAR + 1)
    .nullable()
    .default(null),
  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
  description: z.string().nullable().default(null),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .default(null),
  imageUrl: z.string().nullable().default(null),
});

export const BottleCandidateSearchInputSchema = z.object({
  query: z.string().trim().nullable().default(null),
  brand: z.string().trim().nullable().default(null),
  bottler: z.string().trim().nullable().default(null),
  expression: z.string().trim().nullable().default(null),
  series: z.string().trim().nullable().default(null),
  distillery: z.array(z.string().trim()).default([]),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  abv: z.number().nullable().default(null),
  cask_type: z.string().trim().nullable().default(null),
  cask_size: CaskSizeEnum.nullable().default(null),
  cask_fill: CaskFillEnum.nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  vintage_year: z.number().int().nullable().default(null),
  release_year: z.number().int().nullable().default(null),
  currentBottleId: z.number().nullable().default(null),
  currentReleaseId: z.number().nullable().default(null),
  limit: z.number().int().min(1).max(25).default(15),
});

export const SearchEntitiesArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Producer, distillery, or bottler name to resolve. Use the cleanest entity text you have, without bottle-specific suffixes.",
    ),
  type: EntityTypeEnum.nullable()
    .default(null)
    .describe(
      "Entity type hint to narrow results. Use when you know whether you need a brand, distillery, or bottler match.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum number of entity candidates to return."),
});

export const BottleIdentityScopeEnum = z.enum(["product", "exact_cask"]);

export const BottleObservationSchema = z
  .object({
    selector: z.string().trim().nullable().default(null),
    caskNumber: z.string().trim().nullable().default(null),
    barrelNumber: z.string().trim().nullable().default(null),
    bottleNumber: z.string().trim().nullable().default(null),
    outturn: z.number().int().positive().nullable().default(null),
    market: z.string().trim().nullable().default(null),
    exclusive: z.string().trim().nullable().default(null),
  })
  .strict();

const BottleClassifierDecisionBaseSchema = z.object({
  confidence: z.number().min(0).max(100),
  rationale: z.string().nullable().default(null),
  candidateBottleIds: z.array(z.number().int()).default([]),
  identityScope: BottleIdentityScopeEnum.default("product"),
  observation: BottleObservationSchema.nullable().default(null),
});

const MatchDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("match"),
  matchedBottleId: z.number().int(),
  matchedReleaseId: z.number().int().nullable().default(null),
  parentBottleId: z.null().default(null),
  proposedBottle: z.null().default(null),
  proposedRelease: z.null().default(null),
});

const CreateBottleDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("create_bottle"),
  matchedBottleId: z.null().default(null),
  matchedReleaseId: z.null().default(null),
  parentBottleId: z.null().default(null),
  proposedBottle: ProposedBottleSchema,
  proposedRelease: z.null().default(null),
});

const CreateReleaseDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("create_release"),
  matchedBottleId: z.null().default(null),
  matchedReleaseId: z.null().default(null),
  parentBottleId: z.number().int(),
  proposedBottle: z.null().default(null),
  proposedRelease: ProposedReleaseSchema,
});

const CreateBottleAndReleaseDecisionSchema =
  BottleClassifierDecisionBaseSchema.extend({
    action: z.literal("create_bottle_and_release"),
    matchedBottleId: z.null().default(null),
    matchedReleaseId: z.null().default(null),
    parentBottleId: z.null().default(null),
    proposedBottle: ProposedBottleSchema,
    proposedRelease: ProposedReleaseSchema,
  });

const NoMatchDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("no_match"),
  matchedBottleId: z.null().default(null),
  matchedReleaseId: z.null().default(null),
  parentBottleId: z.null().default(null),
  proposedBottle: z.null().default(null),
  proposedRelease: z.null().default(null),
});

type BottleClassificationDecisionInput =
  | z.infer<typeof MatchDecisionSchema>
  | z.infer<typeof CreateBottleDecisionSchema>
  | z.infer<typeof CreateReleaseDecisionSchema>
  | z.infer<typeof CreateBottleAndReleaseDecisionSchema>
  | z.infer<typeof NoMatchDecisionSchema>;

function validateBottleClassificationDecisionShape(
  value: BottleClassificationDecisionInput,
  ctx: z.RefinementCtx,
) {
  if (
    value.identityScope === "exact_cask" &&
    (value.action === "create_release" ||
      value.action === "create_bottle_and_release")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["identityScope"],
      message:
        "Exact-cask identity cannot create a child release beneath the bottle.",
    });
  }

  if (value.identityScope === "exact_cask" && value.matchedReleaseId !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matchedReleaseId"],
      message:
        "Exact-cask identity cannot point at a separate matched release id.",
    });
  }
}

export const BottleClassificationDecisionSchema = z
  .discriminatedUnion("action", [
    MatchDecisionSchema,
    CreateBottleDecisionSchema,
    CreateReleaseDecisionSchema,
    CreateBottleAndReleaseDecisionSchema,
    NoMatchDecisionSchema,
  ])
  .superRefine(validateBottleClassificationDecisionShape);

const AgentProposedBottleSchema = ProposedBottleSchema.extend({
  abv: z.number().nullable().default(null),
});

const AgentProposedReleaseSchema = ProposedReleaseSchema.extend({
  abv: z.number().nullable().default(null),
});

export const BottleClassifierAgentDecisionSchema = z.object({
  action: z.enum([
    "match",
    "create_bottle",
    "create_release",
    "create_bottle_and_release",
    "no_match",
  ]),
  confidence: z.number().min(0).max(100),
  rationale: z.string().nullable().default(null),
  candidateBottleIds: z.array(z.number().int()).default([]),
  identityScope: BottleIdentityScopeEnum.nullable().default(null),
  observation: BottleObservationSchema.nullable().default(null),
  matchedBottleId: z.number().int().nullable().default(null),
  matchedReleaseId: z.number().int().nullable().default(null),
  parentBottleId: z.number().int().nullable().default(null),
  proposedBottle: AgentProposedBottleSchema.nullable().default(null),
  proposedRelease: AgentProposedReleaseSchema.nullable().default(null),
});

export const BottleClassifierAgentResponseSchema = z.object({
  decision: BottleClassifierAgentDecisionSchema,
});

export const EntityResolutionSchema = z.object({
  entityId: z.number(),
  name: z.string(),
  shortName: z.string().nullable().default(null),
  type: z.array(EntityTypeEnum).default([]),
  alias: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});

export const SearchEntitiesResultSchema = z.object({
  results: z.array(EntityResolutionSchema),
});

export type BottleExtractedDetails = z.infer<
  typeof BottleExtractedDetailsSchema
>;
export type BottleEvidenceSourceTier = z.infer<
  typeof BottleEvidenceSourceTierEnum
>;
export type BottleEvidenceCheck = z.infer<typeof BottleEvidenceCheckSchema>;
export type CaskFill = z.infer<typeof CaskFillEnum>;
export type CaskSize = z.infer<typeof CaskSizeEnum>;
export type CaskType = z.infer<typeof CaskTypeEnum>;
export type Category = z.infer<typeof CategoryEnum>;
export type BottleCandidate = z.infer<typeof BottleCandidateSchema>;
export type BottleSearchEvidence = z.infer<typeof BottleSearchEvidenceSchema>;
export type BottleCandidateSearchInput = z.infer<
  typeof BottleCandidateSearchInputSchema
>;
export type SearchEntitiesArgs = z.infer<typeof SearchEntitiesArgsSchema>;
export type BottleClassifierAgentDecision = z.infer<
  typeof BottleClassifierAgentDecisionSchema
>;
export type BottleClassificationDecision = z.infer<
  typeof BottleClassificationDecisionSchema
>;
export type BottleObservation = z.infer<typeof BottleObservationSchema>;
export type EntityResolution = z.infer<typeof EntityResolutionSchema>;
export type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
export type ProposedRelease = z.infer<typeof ProposedReleaseSchema>;
