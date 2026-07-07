import { readdirSync } from "node:fs";
import { z } from "zod";
import {
  AliasScopeEnum,
  BottleCandidateSchema,
  BottleExtractedDetailsSchema,
  CategoryEnum,
} from "./classifierTypes";
import {
  BottleReferenceSchema,
  CandidateExpansionModeSchema,
} from "./contract";
import { ImageBottleEvidenceSchema } from "./imageEvidence";
import { LocalCatalogSchema } from "./localCatalog";

export const searchResponseFixtureSchema = z.object({
  when: z.array(z.string().min(1)).min(1),
  results: z.array(BottleCandidateSchema),
});

const evalFixtureDbOutcomeSchema = z
  .object({
    bottleId: z.number().int().positive().nullable().optional(),
    releaseId: z.number().int().positive().nullable().optional(),
    createsBottle: z.boolean().optional(),
    createsRelease: z.boolean().optional(),
    summary: z.string().min(1),
  })
  .strict();

const evalFixtureCatalogFieldObservationSchema = z
  .object({
    target: z.enum([
      "matched_bottle",
      "matched_release",
      "candidate_bottle",
      "candidate_release",
    ]),
    bottleId: z.number().int().positive().optional(),
    releaseId: z.number().int().positive().optional(),
    field: z.string().trim().min(1),
    productionValue: z.unknown().optional(),
    evidenceValue: z.unknown(),
    source: z.enum(["image_evidence", "production_search"]),
    issue: z.enum([
      "missing_in_production",
      "conflicts_with_evidence",
      "competing_candidate",
    ]),
    safeToAutoFill: z.boolean(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.target === "matched_bottle" ||
        value.target === "candidate_bottle") &&
      value.bottleId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bottle field observations must include bottleId.",
        path: ["bottleId"],
      });
    }

    if (
      (value.target === "matched_release" ||
        value.target === "candidate_release") &&
      value.releaseId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Release field observations must include releaseId.",
        path: ["releaseId"],
      });
    }
  });

export const evalFixtureProvenanceSchema = z
  .object({
    source: z.enum(["production_miss", "curated_regression", "synthetic"]),
    verifiedSourceUrls: z.array(z.string().url()).optional(),
    fixtureImagePath: z.string().trim().min(1).optional(),
    dbOutcome: evalFixtureDbOutcomeSchema.optional(),
    catalogFieldObservations: z
      .array(evalFixtureCatalogFieldObservationSchema)
      .optional(),
    notes: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.source === "production_miss" &&
      (value.verifiedSourceUrls === undefined ||
        value.verifiedSourceUrls.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` fixtures must include verified source URLs.",
        path: ["verifiedSourceUrls"],
      });
    }

    if (value.source === "production_miss" && value.dbOutcome === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`production_miss` fixtures must include a DB outcome.",
        path: ["dbOutcome"],
      });
    }
  });

export const classifierEvalExpectationSchema = z.object({
  status: z.enum(["ignored", "classified"]),
  action: z
    .enum([
      "match",
      "create_bottle",
      "create_release",
      "create_bottle_and_release",
      "repair_parent_and_create_release",
      "no_match",
    ])
    .optional(),
  identityScope: z.enum(["product", "exact_cask"]).optional(),
  aliasScope: AliasScopeEnum.optional(),
  matchedBottleId: z.number().int().nullable().optional(),
  matchedReleaseId: z.number().int().nullable().optional(),
  parentBottleId: z.number().int().nullable().optional(),
  proposedBottle: z.record(z.string(), z.unknown()).nullable().optional(),
  proposedBottleNameIncludes: z.array(z.string().min(1)).optional(),
  proposedBottleNameExcludes: z.array(z.string().min(1)).optional(),
  proposedRelease: z.record(z.string(), z.unknown()).nullable().optional(),
  expectedTier: z.enum(["auto", "review"]).optional(),
  verifyEligible: z.boolean().optional(),
  suggestedNextStep: z
    .enum(["confirm_match", "confirm_create", "manual_search", "needs_review"])
    .optional(),
  summary: z.string().min(1),
});

export const classifierEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    input: z
      .object({
        reference: BottleReferenceSchema,
        extractedIdentity: BottleExtractedDetailsSchema.nullable().optional(),
        imageEvidence: ImageBottleEvidenceSchema.nullable().optional(),
        initialCandidates: z.array(BottleCandidateSchema).optional(),
        candidateExpansion: CandidateExpansionModeSchema.optional(),
      })
      .strict(),
    searchResponses: z.array(searchResponseFixtureSchema).optional(),
    localCatalog: LocalCatalogSchema.optional(),
    provenance: evalFixtureProvenanceSchema.optional(),
    expected: classifierEvalExpectationSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.localCatalog !== undefined) {
      if (value.input.initialCandidates !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "`localCatalog` fixtures must derive candidates from the catalog, not precompute `input.initialCandidates`.",
          path: ["input", "initialCandidates"],
        });
      }

      if (value.searchResponses !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "`localCatalog` fixtures must use the catalog-backed search adapter, not `searchResponses`.",
          path: ["searchResponses"],
        });
      }
    }

    if (value.provenance?.source !== "production_miss") {
      return;
    }

    if (!value.input.reference.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` fixtures must preserve the observed reference URL.",
        path: ["input", "reference", "url"],
      });
    }

    if (value.input.extractedIdentity == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` fixtures must preserve the observed extracted identity.",
        path: ["input", "extractedIdentity"],
      });
    }

    if (
      value.localCatalog === undefined &&
      (value.input.initialCandidates === undefined ||
        value.input.initialCandidates.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` fixtures must preserve observed local candidates or local catalog state.",
        path: ["input", "initialCandidates"],
      });
    }

    if (
      value.localCatalog !== undefined &&
      value.input.initialCandidates === undefined &&
      value.localCatalog.bottles.length === 0 &&
      value.localCatalog.releases.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` localCatalog fixtures must include at least one local bottle or release row.",
        path: ["localCatalog"],
      });
    }
  });

export const bottleNormalizationReleaseIdentitySchema = z
  .object({
    edition: z.string().nullable().optional(),
    releaseYear: z.number().int().nullable().optional(),
    vintageYear: z.number().int().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "`releaseIdentity` must encode at least one required field.",
  });

export const bottleNormalizationExpectationSchema = z
  .object({
    handlingStrategy: z.enum([
      "deterministic_safe",
      "classifier_required",
      "block_if_uncertain",
    ]),
    classifierExpectation: z.enum([
      "bottle",
      "bottle_plus_release",
      "exact_cask",
      "review_required",
    ]),
    classifierExpectations: z
      .array(
        z.enum([
          "bottle",
          "bottle_plus_release",
          "exact_cask",
          "review_required",
        ]),
      )
      .min(1)
      .optional(),
    deterministicReleaseExpectation: z.enum(["none", "strong_release_marker"]),
    releaseIdentity: bottleNormalizationReleaseIdentitySchema.nullable(),
    releaseIdentities: z
      .array(bottleNormalizationReleaseIdentitySchema)
      .min(1)
      .optional(),
  })
  .superRefine((value, ctx) => {
    const classifierExpectations = value.classifierExpectations ?? [
      value.classifierExpectation,
    ];
    const expectsRelease = classifierExpectations.includes(
      "bottle_plus_release",
    );
    const hasReleaseIdentity =
      value.releaseIdentity !== null || value.releaseIdentities !== undefined;

    if (expectsRelease && !hasReleaseIdentity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`bottle_plus_release` fixtures must declare `releaseIdentity`.",
      });
    }

    if (!expectsRelease && hasReleaseIdentity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Only `bottle_plus_release` fixtures may declare `releaseIdentity`.",
      });
    }

    if (
      value.handlingStrategy !== "deterministic_safe" &&
      value.deterministicReleaseExpectation !== "none"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Only `deterministic_safe` fixtures may opt into deterministic release repair.",
      });
    }

    if (
      value.handlingStrategy === "block_if_uncertain" &&
      value.classifierExpectation !== "review_required"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`block_if_uncertain` fixtures must use `review_required` classifier expectation.",
      });
    }
  });

export type BottleNormalizationExpectation = z.infer<
  typeof bottleNormalizationExpectationSchema
>;

export const realWorldNewBottleFixtureSchema = z
  .object({
    id: z.string().min(1),
    referenceName: z.string().min(1),
    expectedBottleName: z.string().min(1),
    expectedBottleNames: z.array(z.string().min(1)).min(1).optional(),
    summary: z.string().min(1),
    peatedBottleIds: z.array(z.number().int().positive()).min(1),
    provenance: evalFixtureProvenanceSchema.optional(),
    expected: bottleNormalizationExpectationSchema,
  })
  .strict();

export type RealWorldNewBottleFixture = z.infer<
  typeof realWorldNewBottleFixtureSchema
>;

export const legacyReleaseRepairParentCandidateSchema = z
  .object({
    abv: z.number().min(0).max(100).nullable(),
    category: CategoryEnum.nullable(),
    caskStrength: z.boolean().nullable(),
    edition: z.string().nullable(),
    fullName: z.string().min(1),
    id: z.number().int().positive(),
    releaseYear: z.number().int().nullable(),
    singleCask: z.boolean().nullable(),
    statedAge: z.number().int().min(0).max(100).nullable(),
    totalTastings: z.number().int().min(0).nullable(),
    vintageYear: z.number().int().nullable(),
  })
  .strict();

export const legacyReleaseRepairBlockedReasonSchema = z.enum([
  "classifier_ignored",
  "classifier_exact_cask",
  "classifier_outside_parent_set",
  "classifier_dirty_parent_candidate",
  "classifier_unresolved_parent_decision",
]);

export const legacyReleaseRepairResolutionExpectationSchema = z
  .object({
    blockedReason: legacyReleaseRepairBlockedReasonSchema.optional(),
    parentBottleId: z.number().int().positive().optional(),
    resolution: z.enum([
      "allow_create_parent",
      "blocked",
      "reuse_existing_parent",
    ]),
    summary: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (
      value.resolution === "reuse_existing_parent" &&
      value.parentBottleId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`reuse_existing_parent` fixtures must declare `parentBottleId`.",
      });
    }

    if (
      value.resolution !== "reuse_existing_parent" &&
      value.parentBottleId !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Only `reuse_existing_parent` fixtures may declare `parentBottleId`.",
      });
    }

    if (value.resolution === "blocked" && value.blockedReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`blocked` fixtures must declare `blockedReason`.",
      });
    }

    if (value.resolution !== "blocked" && value.blockedReason !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only `blocked` fixtures may declare `blockedReason`.",
      });
    }
  });

export const legacyReleaseRepairResolutionEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    referenceName: z.string().min(1),
    extractedIdentity: BottleExtractedDetailsSchema.nullable().optional(),
    initialCandidates: z.array(BottleCandidateSchema).optional(),
    reviewedParentRows: z.array(legacyReleaseRepairParentCandidateSchema),
    expected: legacyReleaseRepairResolutionExpectationSchema,
  })
  .strict();

export type LegacyReleaseRepairResolutionEvalFixture = z.infer<
  typeof legacyReleaseRepairResolutionEvalFixtureSchema
>;

export function listFixtureFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = `${dir}/${entry.name}`;

      if (entry.isDirectory()) {
        return listFixtureFiles(absolutePath);
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        return [absolutePath];
      }

      return [];
    })
    .sort();
}
