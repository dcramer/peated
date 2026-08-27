import { z } from "zod";

export const CATEGORY_LIST = [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "single_pot_still",
  "spirit",
] as const;

export const BOTTLE_ENTITY_ROLE_LIST = [
  "brand",
  "bottler",
  "distiller",
] as const;
export const ENTITY_KIND_LIST = [
  "brand",
  "distillery",
  "bottler",
  "blender",
  "company",
] as const;

export const ALIAS_SCOPES = ["global_alias", "none"] as const;

export const CategoryEnum = z.enum(CATEGORY_LIST);
export const BottleEntityRoleEnum = z.enum(BOTTLE_ENTITY_ROLE_LIST);
export const EntityKindEnum = z.enum(ENTITY_KIND_LIST);
export const AliasScopeEnum = z.enum(ALIAS_SCOPES);

const CURRENT_YEAR = new Date().getFullYear();

const MaturationSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .nullable()
  .default(null);
const CaskNumberSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .default(null);
const OutturnSchema = z.number().int().positive().nullable().default(null);

export const BOTTLE_EXACT_TRAIT_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "bottlingYear",
  "abv",
  "singleCask",
  "caskStrength",
  "maturation",
  "caskNumber",
  "outturn",
] as const;

export const BOTTLE_DECISION_TRAIT_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskNumber",
] as const satisfies ReadonlyArray<(typeof BOTTLE_EXACT_TRAIT_FIELDS)[number]>;

const BottleExactTraitFieldEnum = z.enum(BOTTLE_EXACT_TRAIT_FIELDS);

const BottleCandidateSiblingSchema = z
  .object({
    bottleId: z.number().int(),
    fullName: z.string(),
    traitFields: z.array(BottleExactTraitFieldEnum).default([]),
    statedAge: z.number().min(0).max(100).nullable().default(null),
    edition: z.string().trim().nullable().default(null),
    releaseYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .default(null),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .default(null),
    bottlingYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .optional(),
    abv: z.number().min(0).max(100).nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    maturation: MaturationSchema,
    caskNumber: CaskNumberSchema,
    outturn: OutturnSchema,
  })
  .strict();

const BottleCandidateFamilyContextSchema = z
  .object({
    siblingBottles: z
      .array(BottleCandidateSiblingSchema)
      .default([])
      .describe(
        "Same-family Bottle rows returned by local search, useful for identifying the complete marketed Bottle without selecting a BottleGroup.",
      ),
  })
  .strict();

export const BottleExtractedDetailsSchema = z
  .object({
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
    // Model and replay data can omit fields added later. Omission and null both
    // mean that the value is unknown; server inputs store unknown values as null.
    bottling_year: z.number().nullable().optional(),
    cask_strength: z.boolean().nullable().default(null),
    single_cask: z.boolean().nullable().default(null),
    maturation: MaturationSchema,
    cask_number: CaskNumberSchema,
    outturn: OutturnSchema,
    edition: z.string().nullable().default(null),
  })
  .strict();

export const BottleCandidateSchema = z
  .object({
    bottleId: z.number().int(),
    alias: z.string().nullable().default(null),
    fullName: z.string(),
    brand: z.string().nullable().default(null),
    bottler: z.string().nullable().default(null),
    series: z.string().nullable().default(null),
    distillery: z.array(z.string()).default([]),
    category: CategoryEnum.nullable().default(null),
    statedAge: z.number().min(0).max(100).nullable().default(null),
    edition: z.string().trim().nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    maturation: MaturationSchema,
    caskNumber: CaskNumberSchema,
    outturn: OutturnSchema,
    abv: z.number().min(0).max(100).nullable().default(null),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .default(null),
    bottlingYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .optional(),
    releaseYear: z
      .number()
      .int()
      .gte(1800)
      .lte(CURRENT_YEAR)
      .nullable()
      .default(null),
    score: z.number().nullable().default(null),
    source: z.array(z.string()).default([]),
    familyContext: BottleCandidateFamilyContextSchema.nullable().optional(),
  })
  .strict();

// Score orders runtime retrieval, and source tracks retrieval provenance.
// Neither is Bottle identity evidence, so neither reaches the agent.
export const AgentBottleCandidateSchema = BottleCandidateSchema.omit({
  score: true,
  source: true,
}).strip();

export const BottleSearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  extraSnippets: z.array(z.string()).default([]),
});

export const BottleSearchEvidenceSchema = z.object({
  provider: z.enum(["openai", "firecrawl"]).default("openai"),
  query: z.string(),
  summary: z.string().nullable().default(null),
  results: z.array(BottleSearchResultSchema).default([]),
});

// Legacy checks may contain official, critic, retailer, or unknown. Current
// code only writes external or origin_retailer.
export const BottleEvidenceSourceTierEnum = z.enum([
  "official",
  "critic",
  "retailer",
  "external",
  "origin_retailer",
  "unknown",
]);

export const BottleEvidenceCheckSchema = z
  .object({
    attribute: z.enum([
      "brand",
      "bottler",
      "name",
      "series",
      "distillery",
      "category",
      "statedAge",
      "edition",
      "caskStrength",
      "singleCask",
      "maturation",
      "caskNumber",
      "outturn",
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
  })
  .strict();

export const ProposedEntityChoiceSchema = z
  .object({
    id: z.number().int().nullable().default(null),
    name: z.string().trim().min(1),
    kind: EntityKindEnum.nullable()
      .optional()
      .describe(
        "Best single Entity kind. Set this when proposing a new Entity; an existing Entity keeps its stored kind.",
      ),
  })
  .strict();

export const ProposedSeriesChoiceSchema = z
  .object({
    id: z.number().int().nullable().default(null),
    name: z.string().trim().min(1),
  })
  .strict();

export const ProposedBottleFields = {
  name: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Stable marketed expression relative to the Brand. Omit the Brand prefix and exact traits represented by other fields. When no separate expression is marketed, use the source-supported product or style phrase. Do not repeat the Brand, copy a retailer title, or invent an expression.",
    ),
  series: ProposedSeriesChoiceSchema.nullable().default(null),
  category: CategoryEnum.nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  statedAge: z.number().int().min(0).max(100).nullable().default(null),
  caskStrength: z.boolean().nullable().default(null),
  singleCask: z.boolean().nullable().default(null),
  maturation: MaturationSchema,
  caskNumber: CaskNumberSchema,
  outturn: OutturnSchema,
  abv: z.number().min(0).max(100).nullable().default(null),
  vintageYear: z
    .number()
    .int()
    .gte(1800)
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  bottlingYear: z
    .number()
    .int()
    .gte(1800)
    .lte(CURRENT_YEAR)
    .nullable()
    .optional(),
  releaseYear: z
    .number()
    .int()
    .gte(1800)
    .lte(CURRENT_YEAR)
    .nullable()
    .default(null),
  brand: ProposedEntityChoiceSchema,
  distillers: z.array(ProposedEntityChoiceSchema).default([]),
  bottler: ProposedEntityChoiceSchema.nullable().default(null),
} as const;

export const ProposedBottleSchema = z.object(ProposedBottleFields).strict();

export const MAX_BOTTLE_CANDIDATES = 25;

export const BottleCandidateSearchInputSchema = z
  .object({
    query: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Bottle search text. Exclude volume, pack-size, gift-set, and price noise.",
      ),
    brand: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Most prominent consumer-facing brand on the label. For independent bottlings, this is usually the bottler label, not the distillery.",
      ),
    bottler: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Named market-facing bottler or release imprint for this product. It may equal the brand or a distillery; leave null when product-specific evidence does not establish this Bottle relationship.",
      ),
    expression: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Core release name after removing brand, age, ABV, and generic style words.",
      ),
    series: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Stable range or family name such as Private Selection or Distillers Edition. Do not use for one-off batch codes.",
      ),
    distillery: z
      .array(z.string().trim())
      .default([])
      .describe(
        "Producing distillery or distilleries when known. Use an empty array when unknown.",
      ),
    category: z
      .enum(CATEGORY_LIST)
      .nullable()
      .default(null)
      .describe(
        "Normalized whisky category when known. Leave null instead of guessing.",
      ),
    stated_age: z
      .number()
      .nullable()
      .default(null)
      .describe("Age statement in years."),
    abv: z
      .number()
      .nullable()
      .default(null)
      .describe(
        "Alcohol by volume percentage as a number, for example 59.2. If the source gives proof, convert it to ABV first.",
      ),
    cask_strength: z
      .boolean()
      .nullable()
      .default(null)
      .describe(
        "True only when the reference explicitly says cask strength, barrel strength, barrel proof, full proof, or natural strength.",
      ),
    single_cask: z
      .boolean()
      .nullable()
      .default(null)
      .describe(
        "True only when the reference explicitly says single cask, single barrel, or a specific cask selection.",
      ),
    maturation: MaturationSchema.describe(
      "Producer-stated cask or maturation details. Preserve the source wording and leave null when it is not stated.",
    ),
    cask_number: CaskNumberSchema.describe(
      "Marketed cask or barrel identifier. Preserve punctuation and leave null when it is not stated.",
    ),
    outturn: OutturnSchema.describe(
      "Producer-stated total number of bottles in the release.",
    ),
    edition: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .describe(
        "Batch label, store-pick code, release code, or numbered edition.",
      ),
    vintage_year: z
      .number()
      .int()
      .nullable()
      .default(null)
      .describe("Distillation year when explicitly stated."),
    release_year: z
      .number()
      .int()
      .nullable()
      .default(null)
      .describe("Marketed release year when explicitly stated."),
    currentBottleId: z
      .number()
      .nullable()
      .default(null)
      .describe(
        "Current assigned bottle id, if the reference is already attached to a bottle.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_BOTTLE_CANDIDATES)
      .default(15)
      .describe("Maximum number of candidates to return."),
  })
  .strict();

export const SearchEntitiesArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Producer, distillery, or bottler name to resolve. Use the cleanest entity text you have, without bottle-specific suffixes.",
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
  })
  .strict();

// Typed categories for unresolved risks. `other` is the uncategorizable
// holistic veto ("something feels off") that still forces review. Any asserted
// risk routes an automated decision to review; risks never upgrade a decision.
export const UNRESOLVED_RISK_CATEGORIES = [
  "trait_conflict",
  "sibling_ambiguity",
  "release_ambiguity",
  "web_evidence_conflict",
  "insufficient_evidence",
  "identity_ambiguity",
  "other",
] as const;

export const UnresolvedRiskCategoryEnum = z.enum(UNRESOLVED_RISK_CATEGORIES);

export const UnresolvedRiskSchema = z
  .object({
    category: UnresolvedRiskCategoryEnum.describe(
      "Typed risk category the review queue can sort on. Use `other` for a holistic concern that no specific category fits.",
    ),
    note: z
      .string()
      .trim()
      .min(1)
      .describe("Short freeform reason describing the risk."),
  })
  .strict();

export const BottleConfidenceBasisSchema = z
  .object({
    unresolvedRisks: z
      .array(UnresolvedRiskSchema)
      .default([])
      .describe(
        "Material conflicts, missing traits, sibling ambiguity, or weak evidence that could change the action or target. Any entry forces automated flows to route the decision to human review.",
      ),
    webEvidence: z
      .enum(["not_needed", "not_used", "supportive", "weak", "conflicting"])
      .default("not_used")
      .describe(
        "How web evidence affected confidence. Use supportive only when web evidence supports a match or create action, not for no_match.",
      ),
  })
  .strict();

const BottleClassifierDecisionBaseSchema = z
  .object({
    rationale: z.string().nullable().default(null),
    candidateBottleIds: z
      .array(z.number().int())
      .max(MAX_BOTTLE_CANDIDATES)
      .default([]),
    identityScope: BottleIdentityScopeEnum.default("product").describe(
      "`product` for stable bottle-family identity; `exact_cask` only when the exact cask itself is the marketed bottle identity. SMWS codes qualify; generic cask/barrel details do not qualify without reliable evidence that the listed product is an exact single-cask identity.",
    ),
    aliasScope: AliasScopeEnum.optional().describe(
      "`global_alias` only when the listing label is safe to store as a reusable bottle alias; `none` when no reusable alias should be created.",
    ),
    observation: BottleObservationSchema.nullable().default(null),
    confidenceBasis: BottleConfidenceBasisSchema.nullable().optional(),
  })
  .strict();

const MatchDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("match"),
  matchedBottleId: z.number().int(),
  proposedBottle: z.null().default(null),
});

const CreateBottleDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("create_bottle"),
  matchedBottleId: z.null().default(null),
  proposedBottle: ProposedBottleSchema,
});

const NoMatchDecisionSchema = BottleClassifierDecisionBaseSchema.extend({
  action: z.literal("no_match"),
  matchedBottleId: z.null().default(null),
  proposedBottle: z.null().default(null),
});

export const BottleClassificationDecisionSchema = z.discriminatedUnion(
  "action",
  [MatchDecisionSchema, CreateBottleDecisionSchema, NoMatchDecisionSchema],
);

export const BottleClassifierActionSchema = z.enum([
  "match",
  "create_bottle",
  "no_match",
]);

// Zod preserves this property order in the JSON schema sent to the model.
// Evidence and rationale must precede the action and its target or draft.
export const BottleClassifierAgentDecisionSchema = z
  .object({
    confidenceBasis: BottleConfidenceBasisSchema.nullable().default(null),
    rationale: z.string().nullable().default(null),
    action: BottleClassifierActionSchema.describe(
      [
        "Decision action.",
        "match: an existing Bottle is the exact marketed product and is safe for this assignment; set matchedBottleId.",
        "create_bottle: no inspected existing Bottle represents the exact marketed product, including plausible malformed candidates; set proposedBottle only, including every marketed release trait needed to identify it.",
        "no_match: no safe existing target and no supported create action, including when an existing Bottle needs a separate Bottle Review before assignment is safe.",
      ].join(" "),
    ),
    identityScope: BottleIdentityScopeEnum.nullable().default(null),
    aliasScope: AliasScopeEnum.nullable().default(null),
    observation: BottleObservationSchema.nullable().default(null),
    candidateBottleIds: z
      .array(z.number().int())
      .max(MAX_BOTTLE_CANDIDATES)
      .default([]),
    matchedBottleId: z.number().int().nullable().default(null),
    proposedBottle: ProposedBottleSchema.nullable()
      .default(null)
      .describe(
        "Required for create_bottle. A create draft describes one independently complete Bottle, including every supported marketed release trait; unknown optional fields may remain null.",
      ),
  })
  .strict();

export const BottleClassifierAgentResponseSchema = z.object({
  decision: BottleClassifierAgentDecisionSchema,
});

export const EntityResolutionSchema = z.object({
  entityId: z.number(),
  name: z.string(),
  shortName: z.string().nullable().default(null),
  kind: EntityKindEnum,
  alias: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
  retrievedFor: z
    .array(
      z.object({
        query: z.string().min(1),
      }),
    )
    .optional(),
});

export const SearchEntitiesResultSchema = z.object({
  results: z.array(EntityResolutionSchema),
});

export type BottleExtractedDetails = z.infer<
  typeof BottleExtractedDetailsSchema
>;
export type BottleConfidenceBasis = z.infer<typeof BottleConfidenceBasisSchema>;
export type UnresolvedRisk = z.infer<typeof UnresolvedRiskSchema>;
export type UnresolvedRiskCategory = z.infer<typeof UnresolvedRiskCategoryEnum>;
export type AliasScope = z.infer<typeof AliasScopeEnum>;
export type BottleEvidenceSourceTier = z.infer<
  typeof BottleEvidenceSourceTierEnum
>;
export type BottleEvidenceCheck = z.infer<typeof BottleEvidenceCheckSchema>;
export type Category = z.infer<typeof CategoryEnum>;
export type BottleCandidate = z.infer<typeof BottleCandidateSchema>;
export type BottleSearchEvidence = z.infer<typeof BottleSearchEvidenceSchema>;
export type BottleCandidateSearchInput = z.infer<
  typeof BottleCandidateSearchInputSchema
>;
export type SearchEntitiesArgs = z.infer<typeof SearchEntitiesArgsSchema>;
type BottleClassifierAgentDecisionOutput = z.infer<
  typeof BottleClassifierAgentDecisionSchema
>;
type BottleClassificationDecisionOutput = z.infer<
  typeof BottleClassificationDecisionSchema
>;
export type BottleClassifierAgentDecision = Omit<
  BottleClassifierAgentDecisionOutput,
  "aliasScope"
> & {
  aliasScope?: AliasScope | null;
};
export type BottleClassificationDecision = BottleClassificationDecisionOutput;
export type BottleClassifierAgentDecisionInput = Omit<
  z.input<typeof BottleClassifierAgentDecisionSchema>,
  "aliasScope"
> & {
  aliasScope?: AliasScope | null;
};
export type BottleObservation = z.infer<typeof BottleObservationSchema>;
export type EntityResolution = z.infer<typeof EntityResolutionSchema>;
export type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
