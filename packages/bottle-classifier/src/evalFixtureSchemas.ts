import { readdirSync } from "node:fs";
import { z } from "zod";
import {
  BottleCandidateSchema,
  BottleExtractedDetailsSchema,
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
} from "./classifierTypes";
import {
  BottleReferenceSchema,
  CandidateExpansionModeSchema,
} from "./contract";

export const searchResponseFixtureSchema = z.object({
  when: z.array(z.string().min(1)).min(1),
  results: z.array(BottleCandidateSchema),
});

export const classifierEvalExpectationSchema = z.object({
  status: z.enum(["ignored", "classified"]),
  action: z
    .enum([
      "match",
      "create_bottle",
      "create_release",
      "create_bottle_and_release",
      "no_match",
    ])
    .optional(),
  identityScope: z.enum(["product", "exact_cask"]).optional(),
  matchedBottleId: z.number().int().nullable().optional(),
  matchedReleaseId: z.number().int().nullable().optional(),
  parentBottleId: z.number().int().nullable().optional(),
  proposedBottle: z.record(z.string(), z.unknown()).nullable().optional(),
  proposedRelease: z.record(z.string(), z.unknown()).nullable().optional(),
  confidenceAtLeast: z.number().optional(),
  confidenceBelow: z.number().optional(),
  verifyEligible: z.boolean().optional(),
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
        initialCandidates: z.array(BottleCandidateSchema).optional(),
        candidateExpansion: CandidateExpansionModeSchema.optional(),
      })
      .strict(),
    searchResponses: z.array(searchResponseFixtureSchema).optional(),
    expected: classifierEvalExpectationSchema,
  })
  .strict();

export const bottleNormalizationReleaseIdentitySchema = z.object({
  edition: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
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
    deterministicReleaseExpectation: z.enum(["none", "strong_release_marker"]),
    releaseIdentity: bottleNormalizationReleaseIdentitySchema.nullable(),
  })
  .superRefine((value, ctx) => {
    const hasReleaseIdentity = value.releaseIdentity !== null;

    if (
      value.classifierExpectation === "bottle_plus_release" &&
      !hasReleaseIdentity
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`bottle_plus_release` fixtures must declare `releaseIdentity`.",
      });
    }

    if (
      value.classifierExpectation !== "bottle_plus_release" &&
      hasReleaseIdentity
    ) {
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
    summary: z.string().min(1),
    peatedBottleIds: z.array(z.number().int().positive()).min(1),
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
    caskFill: CaskFillEnum.nullable(),
    caskSize: CaskSizeEnum.nullable(),
    caskStrength: z.boolean().nullable(),
    caskType: CaskTypeEnum.nullable(),
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
