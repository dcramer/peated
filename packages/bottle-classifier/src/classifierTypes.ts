import { z } from "zod";

// SAFETY: Array.map preserves the tuple order and returns each literal id unchanged.
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

export const ALIAS_SCOPES = ["global_alias", "none"] as const;

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
export const AliasScopeEnum = z.enum(ALIAS_SCOPES);

const CURRENT_YEAR = new Date().getFullYear();

export const BOTTLE_EXACT_TRAIT_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskType",
  "caskSize",
  "caskFill",
] as const;

export const BOTTLE_DECISION_TRAIT_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
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
    abv: z.number().min(0).max(100).nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    caskType: CaskTypeEnum.nullable().default(null),
    caskSize: CaskSizeEnum.nullable().default(null),
    caskFill: CaskFillEnum.nullable().default(null),
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
    cask_strength: z.boolean().nullable().default(null),
    single_cask: z.boolean().nullable().default(null),
    cask_type: CaskTypeEnum.nullable().default(null),
    cask_size: CaskSizeEnum.nullable().default(null),
    cask_fill: CaskFillEnum.nullable().default(null),
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
    caskType: CaskTypeEnum.nullable().default(null),
    caskSize: CaskSizeEnum.nullable().default(null),
    caskFill: CaskFillEnum.nullable().default(null),
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
      "caskType",
      "caskSize",
      "caskFill",
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
  caskType: CaskTypeEnum.nullable().default(null),
  caskSize: CaskSizeEnum.nullable().default(null),
  caskFill: CaskFillEnum.nullable().default(null),
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
        "Named market-facing bottler or release imprint for this product. It may equal the brand or a distillery; leave null when product-specific evidence does not establish the role.",
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
    cask_type: CaskTypeEnum.nullable()
      .default(null)
      .describe(
        "Soft-deprecated optional metadata. Leave null; do not use it to narrow identity search.",
      ),
    cask_size: CaskSizeEnum.nullable()
      .default(null)
      .describe(
        "Soft-deprecated optional metadata. Leave null; do not use it to narrow identity search.",
      ),
    cask_fill: CaskFillEnum.nullable()
      .default(null)
      .describe(
        "Soft-deprecated optional metadata. Leave null; do not use it to narrow identity search.",
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
      .describe("Bottling or release year when explicitly stated."),
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
  type: EntityTypeEnum.nullable()
    .default(null)
    .describe(
      "Entity type hint used to narrow non-exact results. Exact names, short names, and aliases may match an Entity without this role because assignment can add it.",
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

const AgentProposedBottleSchema = ProposedBottleSchema.extend({
  abv: z.number().nullable().default(null),
});

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
    proposedBottle: AgentProposedBottleSchema.nullable()
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
  type: z.array(EntityTypeEnum).default([]),
  alias: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
  retrievedFor: z
    .array(
      z.object({
        query: z.string().min(1),
        requestedType: EntityTypeEnum.nullable(),
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
