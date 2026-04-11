import { classifyBottleReference } from "@peated/server/agents/bottleClassifier/classifyBottleReference";
import { db } from "@peated/server/db";
import { bottles, entities, type Bottle } from "@peated/server/db/schema";
import { hasBottleLevelReleaseTraits } from "@peated/server/lib/bottleSchemaRules";
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

export type LegacyReleaseRepairClassifierParentCandidate = Pick<
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
>;

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
  });

  if (classification.status === "ignored") {
    return {
      resolution: "blocked",
      message: `Classifier could not review parent resolution: ${classification.reason}`,
    };
  }

  const { decision } = classification;
  if (decision.identityScope === "exact_cask") {
    return {
      resolution: "blocked",
      message:
        "Classifier treated this bottle as exact-cask identity, so release repair cannot safely create a reusable parent bottle.",
    };
  }

  if (decision.action === "match" || decision.action === "create_release") {
    const parentBottleId =
      decision.action === "match"
        ? decision.matchedBottleId
        : decision.parentBottleId;

    const parentBottle =
      parentRows.find((row) => row.id === parentBottleId) ?? null;

    if (!parentBottle) {
      return {
        resolution: "blocked",
        message:
          "Classifier pointed at a bottle outside the reviewed repair parent set.",
      };
    }

    if (hasBottleLevelReleaseTraits(parentBottle)) {
      return {
        resolution: "blocked",
        message:
          "Classifier found a reusable parent candidate, but that bottle still has bottle-level release traits.",
      };
    }

    return {
      resolution: "reuse_existing_parent",
      parentBottle,
    };
  }

  if (
    decision.action === "create_bottle" ||
    decision.action === "create_bottle_and_release"
  ) {
    return {
      resolution: "allow_create_parent",
    };
  }

  return {
    resolution: "blocked",
    message:
      "Classifier could not verify whether this repair should reuse an existing parent bottle or create a new one.",
  };
}
