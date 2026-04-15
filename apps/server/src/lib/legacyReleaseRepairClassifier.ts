import {
  getLegacyReleaseRepairClassifierBlockedReasonMessage,
  resolveLegacyCreateParentClassification,
} from "@peated/bottle-classifier/legacyReleaseRepairResolution";
import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import { db } from "@peated/server/db";
import { bottles, entities, type Bottle } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

export type LegacyReleaseRepairClassifierBottle = Pick<
  Bottle,
  | "abv"
  | "brandId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "category"
  | "edition"
  | "fullName"
  | "id"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "vintageYear"
  | "caskType"
>;

export type LegacyReleaseRepairClassifierParentCandidate = Omit<
  Pick<
    Bottle,
    | "abv"
    | "caskFill"
    | "caskSize"
    | "caskStrength"
    | "category"
    | "edition"
    | "fullName"
    | "id"
    | "releaseYear"
    | "singleCask"
    | "statedAge"
    | "totalTastings"
    | "vintageYear"
    | "caskType"
  >,
  "totalTastings"
> & {
  totalTastings: null | number;
};

export type ClassifierReviewedCreateParentResolution =
  | {
      parentBottle: LegacyReleaseRepairClassifierParentCandidate;
      resolution: "reuse_existing_parent";
    }
  | {
      resolution: "allow_create_parent";
    }
  | {
      message: string;
      resolution: "blocked";
    };

export async function reviewLegacyCreateParentResolutionWithClassifier({
  legacyBottle,
  parentRows,
}: {
  legacyBottle: LegacyReleaseRepairClassifierBottle;
  parentRows: LegacyReleaseRepairClassifierParentCandidate[];
}): Promise<ClassifierReviewedCreateParentResolution> {
  const [brand] = await db
    .select({
      name: entities.name,
      shortName: entities.shortName,
    })
    .from(entities)
    .where(eq(entities.id, legacyBottle.brandId))
    .limit(1);

  const initialCandidates = parentRows
    .filter((row) => row.id !== legacyBottle.id)
    .map((row) => ({
      kind: "bottle" as const,
      bottleId: row.id,
      releaseId: null,
      alias: null,
      fullName: row.fullName,
      bottleFullName: row.fullName,
      brand: brand?.name ?? brand?.shortName ?? null,
      bottler: null,
      series: null,
      distillery: [],
      category: row.category,
      statedAge: row.statedAge,
      edition: row.edition,
      caskStrength: row.caskStrength,
      singleCask: row.singleCask,
      abv: row.abv,
      vintageYear: row.vintageYear,
      releaseYear: row.releaseYear,
      caskType: row.caskType,
      caskSize: row.caskSize,
      caskFill: row.caskFill,
      score: null,
      source: ["repair_parent"],
    }));

  const classification = await classifyBottleReference({
    reference: {
      name: legacyBottle.fullName,
    },
    extractedIdentity: {
      brand: brand?.name ?? brand?.shortName ?? null,
      bottler: null,
      expression: null,
      series: null,
      distillery: [],
      category: legacyBottle.category,
      stated_age: legacyBottle.statedAge,
      abv: legacyBottle.abv,
      release_year: legacyBottle.releaseYear,
      vintage_year: legacyBottle.vintageYear,
      cask_type: legacyBottle.caskType,
      cask_size: legacyBottle.caskSize,
      cask_fill: legacyBottle.caskFill,
      cask_strength: legacyBottle.caskStrength,
      single_cask: legacyBottle.singleCask,
      edition: legacyBottle.edition,
    },
    initialCandidates,
    // Create-parent review is a closed-set decision between the reviewed
    // parent candidates versus creating a new parent bottle.
    candidateExpansion: "initial_only",
  });

  const resolution = resolveLegacyCreateParentClassification({
    classification,
    parentRows,
    release: {
      edition: legacyBottle.edition,
      statedAge: legacyBottle.statedAge,
      abv: legacyBottle.abv,
      releaseYear: legacyBottle.releaseYear,
      vintageYear: legacyBottle.vintageYear,
      singleCask: legacyBottle.singleCask,
      caskStrength: legacyBottle.caskStrength,
      caskFill: legacyBottle.caskFill,
      caskType: legacyBottle.caskType,
      caskSize: legacyBottle.caskSize,
    },
  });

  if (resolution.resolution === "reuse_existing_parent") {
    return resolution;
  }

  if (resolution.resolution === "allow_create_parent") {
    return resolution;
  }

  return {
    resolution: "blocked",
    message: getLegacyReleaseRepairClassifierBlockedReasonMessage({
      reason: resolution.reason,
      ignoredReason: resolution.ignoredReason,
    }),
  };
}
