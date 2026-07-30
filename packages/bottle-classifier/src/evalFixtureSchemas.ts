import { readdirSync } from "node:fs";
import { z } from "zod";
import {
  AuditBottleInputSchema,
  FindingSchema,
  ProposedOperationsSchema,
} from "./bottleCheckContract";
import { listBottleCheckOperationTargets } from "./bottleCheckEvalScoring";
import { BottleContextSeriesRefSchema } from "./bottleContextContract";
import {
  AliasScopeEnum,
  BottleCandidateSchema,
  BottleExtractedDetailsSchema,
  BottleSearchEvidenceSchema,
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  EntityResolutionSchema,
} from "./classifierTypes";
import {
  AuditBottleResultSchema,
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
    .enum(["match", "create_bottle", "repair_bottle", "no_match"])
    .optional(),
  identityScope: z.enum(["product", "exact_cask"]).optional(),
  aliasScope: AliasScopeEnum.optional(),
  matchedBottleId: z.number().int().nullable().optional(),
  proposedBottle: z.record(z.string(), z.unknown()).nullable().optional(),
  proposedBottleNameIncludes: z.array(z.string().min(1)).optional(),
  proposedBottleNameExcludes: z.array(z.string().min(1)).optional(),
  proposedBottleDistillerIdOneOf: z
    .array(z.number().int().positive())
    .min(1)
    .optional(),
  expectedTier: z.enum(["auto", "review"]).optional(),
  verifyEligible: z.boolean().optional(),
  suggestedNextStep: z
    .enum(["confirm_match", "confirm_create", "manual_search", "needs_review"])
    .optional(),
  proposedOperations: ProposedOperationsSchema.default([]),
  findings: z.array(FindingSchema).default([]),
  operationPreparation: z
    .enum(["immediate", "after_primary"])
    .default("immediate"),
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
    const initialCandidateIds = new Set<number>();
    for (const [
      candidateIndex,
      candidate,
    ] of value.input.initialCandidates?.entries() ?? []) {
      if (initialCandidateIds.has(candidate.bottleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate initial candidate Bottle id ${candidate.bottleId}.`,
          path: ["input", "initialCandidates", candidateIndex, "bottleId"],
        });
      }
      initialCandidateIds.add(candidate.bottleId);
    }

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

    if (value.input.extractedIdentity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` fixtures must preserve the observed extracted identity, including an explicit null result.",
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
      value.localCatalog.bottles.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`production_miss` localCatalog fixtures must include at least one local Bottle.",
        path: ["localCatalog"],
      });
    }
  });

export const auditBottleEvalScenarioSchema = z.enum([
  "clean",
  "bottle_update",
  "bottle_merge",
  "entity_operations",
  "unresolved",
  "adversarial",
]);

const auditBottleEvalContextSchema = z
  .object({
    currentBottle: BottleCandidateSchema,
    inspectedBottles: z.array(BottleCandidateSchema).default([]),
    inspectedEntities: z.array(EntityResolutionSchema).default([]),
    inspectedSeries: z.array(BottleContextSeriesRefSchema).default([]),
    searchEvidence: z.array(BottleSearchEvidenceSchema).default([]),
  })
  .strict();

export function normalizeAuditFixtureSeriesName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export const auditBottleEvalFixtureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    scenario: auditBottleEvalScenarioSchema,
    input: z
      .object({
        audit: AuditBottleInputSchema,
        context: auditBottleEvalContextSchema,
      })
      .strict(),
    provenance: evalFixtureProvenanceSchema,
    expected: AuditBottleResultSchema.omit({ artifacts: true }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.input.audit.bottleId !== value.input.context.currentBottle.bottleId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Audit subject and current Bottle ids must match.",
        path: ["input", "context", "currentBottle", "bottleId"],
      });
    }

    const bottleIds = new Set([value.input.context.currentBottle.bottleId]);
    for (const [
      index,
      bottle,
    ] of value.input.context.inspectedBottles.entries()) {
      if (bottleIds.has(bottle.bottleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate inspected Bottle id ${bottle.bottleId}.`,
          path: ["input", "context", "inspectedBottles", index, "bottleId"],
        });
      }
      bottleIds.add(bottle.bottleId);
    }

    const entityIds = new Set<number>();
    for (const [
      index,
      entity,
    ] of value.input.context.inspectedEntities.entries()) {
      if (entityIds.has(entity.entityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate inspected Entity id ${entity.entityId}.`,
          path: ["input", "context", "inspectedEntities", index, "entityId"],
        });
      }
      entityIds.add(entity.entityId);
    }

    const fixtureBottleSeriesNames = new Set(
      [
        value.input.context.currentBottle,
        ...value.input.context.inspectedBottles,
      ].flatMap(({ series }) =>
        series === null ? [] : [normalizeAuditFixtureSeriesName(series)],
      ),
    );
    const seriesIds = new Set<number>();
    const seriesNames = new Set<string>();
    for (const [
      index,
      series,
    ] of value.input.context.inspectedSeries.entries()) {
      if (seriesIds.has(series.seriesId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate inspected BottleSeries id ${series.seriesId}.`,
          path: ["input", "context", "inspectedSeries", index, "seriesId"],
        });
      }
      seriesIds.add(series.seriesId);

      const normalizedName = normalizeAuditFixtureSeriesName(series.name);
      if (seriesNames.has(normalizedName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate inspected BottleSeries name ${series.name}.`,
          path: ["input", "context", "inspectedSeries", index, "name"],
        });
      }
      seriesNames.add(normalizedName);

      if (!fixtureBottleSeriesNames.has(normalizedName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Inspected BottleSeries ${series.name} is not referenced by any fixture Bottle.`,
          path: ["input", "context", "inspectedSeries", index, "name"],
        });
      }
    }

    for (const [
      operationIndex,
      operation,
    ] of value.expected.proposedOperations.entries()) {
      for (const target of listBottleCheckOperationTargets(operation)) {
        const inspected =
          target.kind === "bottle"
            ? bottleIds.has(target.id)
            : target.kind === "entity"
              ? entityIds.has(target.id)
              : seriesIds.has(target.id);
        if (inspected) {
          continue;
        }

        const label =
          target.kind === "bottle"
            ? "Bottle"
            : target.kind === "entity"
              ? "Entity"
              : "BottleSeries";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected operation references uninspected ${label} id ${target.id}.`,
          path: [
            "expected",
            "proposedOperations",
            operationIndex,
            "input",
            ...target.path,
          ],
        });
      }
    }
  });

export type AuditBottleEvalFixture = z.infer<
  typeof auditBottleEvalFixtureSchema
>;

export const bottleNormalizationExactBottleIdentitySchema = z
  .object({
    edition: z.string().nullable().optional(),
    releaseYear: z.number().int().nullable().optional(),
    vintageYear: z.number().int().nullable().optional(),
    caskType: CaskTypeEnum.nullable().optional(),
    caskSize: CaskSizeEnum.nullable().optional(),
    caskFill: CaskFillEnum.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "`exactBottleIdentity` must encode at least one required field.",
  });

export const bottleNormalizationExpectationSchema = z
  .object({
    handlingStrategy: z.enum([
      "deterministic_safe",
      "classifier_required",
      "block_if_uncertain",
    ]),
    classifierExpectation: z.enum(["bottle", "exact_cask", "review_required"]),
    classifierExpectations: z
      .array(z.enum(["bottle", "exact_cask", "review_required"]))
      .min(1)
      .optional(),
    action: z
      .enum(["match", "create_bottle", "repair_bottle", "no_match"])
      .optional(),
    matchedBottleId: z.number().int().nullable().optional(),
    exactBottleIdentity:
      bottleNormalizationExactBottleIdentitySchema.nullable(),
    exactBottleIdentities: z
      .array(bottleNormalizationExactBottleIdentitySchema)
      .min(1)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.exactBottleIdentity !== null &&
      value.exactBottleIdentities !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Use either `exactBottleIdentity` or `exactBottleIdentities`, not both.",
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

    if (value.matchedBottleId !== undefined && value.action !== "match") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`matchedBottleId` requires `action = match`.",
        path: ["matchedBottleId"],
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
