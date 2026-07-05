import type {
  BottleCandidate,
  BottleExtractedDetails,
  BottleSearchEvidence,
} from "./classifierTypes";
import { listMatchesExpectedValue, textsOverlap } from "./identityEvidenceCore";
import { normalizeBottle } from "./normalize";
import {
  hasExternalTargetIdentityEvidenceForExistingMatch,
  hasSupportiveWebEvidenceForExistingMatch as hasSharedSupportiveWebEvidenceForExistingMatch,
  type WebEvidenceJudgment,
} from "./priceMatchingEvidence";

function getTargetNameVariants(targetCandidate: BottleCandidate): string[] {
  return Array.from(
    new Set(
      [
        targetCandidate.alias,
        targetCandidate.bottleFullName,
        targetCandidate.fullName,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function nameMarketsStatedAge({
  name,
  statedAge,
}: {
  name: string | null | undefined;
  statedAge: number | null | undefined;
}): boolean {
  if (!name || statedAge === null || statedAge === undefined) {
    return false;
  }

  const normalizedName = normalizeBottle({
    name,
    statedAge,
  }).name.toLowerCase();

  return new RegExp(`\\b${statedAge}-year-old\\b`, "i").test(normalizedName);
}

export function extractedIdentityLooksLikePlainAgeStatementReference(
  extractedLabel: BottleExtractedDetails | null | undefined,
): boolean {
  if (!extractedLabel) {
    return false;
  }

  return (
    extractedLabel.stated_age !== null &&
    extractedLabel.stated_age !== undefined &&
    !extractedLabel.expression &&
    !extractedLabel.series &&
    !extractedLabel.edition &&
    extractedLabel.release_year === null &&
    extractedLabel.vintage_year === null &&
    extractedLabel.cask_strength === null &&
    extractedLabel.single_cask === null &&
    extractedLabel.abv === null
  );
}

// The legacy `spirit` bucket means the category is unknown, not that the
// bottle is positively identified as a generic spirit family.
function normalizeComparableCategory(
  value:
    | BottleCandidate["category"]
    | BottleExtractedDetails["category"]
    | null,
) {
  return value === "spirit" ? null : value;
}

export function hasSupportiveWebEvidenceForExistingMatch({
  sourceUrl,
  searchEvidence,
  extractedLabel,
  targetCandidate,
  webEvidenceJudgment,
}: {
  sourceUrl: string;
  searchEvidence: BottleSearchEvidence[];
  extractedLabel: BottleExtractedDetails | null;
  targetCandidate: BottleCandidate | null;
  webEvidenceJudgment?: WebEvidenceJudgment;
}) {
  if (!targetCandidate) {
    return false;
  }

  if (
    !hasSharedSupportiveWebEvidenceForExistingMatch({
      sourceUrl,
      searchEvidence,
      extractedLabel,
      target: targetCandidate,
      webEvidenceJudgment,
    })
  ) {
    return false;
  }

  return hasExternalTargetIdentityEvidenceForExistingMatch({
    sourceUrl,
    searchEvidence,
    extractedLabel,
    target: targetCandidate,
    webEvidenceJudgment,
  });
}

export function getExistingMatchIdentityConflicts({
  referenceName,
  targetCandidate,
  extractedLabel,
}: {
  referenceName: string;
  targetCandidate: BottleCandidate | null;
  extractedLabel: BottleExtractedDetails | null;
}) {
  if (!targetCandidate) {
    return [];
  }

  const conflicts: string[] = [];
  const extractedCategory = normalizeComparableCategory(
    extractedLabel?.category ?? null,
  );
  const targetCategory = normalizeComparableCategory(
    targetCandidate.category ?? null,
  );

  if (
    extractedLabel?.brand &&
    targetCandidate.brand &&
    !textsOverlap(extractedLabel.brand, targetCandidate.brand)
  ) {
    conflicts.push("brand");
  }

  if (
    extractedLabel?.bottler &&
    targetCandidate.bottler &&
    !textsOverlap(extractedLabel.bottler, targetCandidate.bottler)
  ) {
    conflicts.push("bottler");
  }

  if (
    extractedLabel?.series &&
    targetCandidate.series &&
    !textsOverlap(extractedLabel.series, targetCandidate.series)
  ) {
    conflicts.push("series");
  }

  if (
    extractedCategory &&
    targetCategory &&
    extractedCategory !== targetCategory
  ) {
    conflicts.push("category");
  }

  if (
    extractedLabel?.distillery?.length &&
    targetCandidate.distillery.length &&
    !listMatchesExpectedValue(
      targetCandidate.distillery,
      extractedLabel.distillery,
    )
  ) {
    conflicts.push("distillery");
  }

  if (
    extractedLabel?.stated_age !== null &&
    extractedLabel?.stated_age !== undefined &&
    targetCandidate.statedAge !== null &&
    extractedLabel.stated_age !== targetCandidate.statedAge &&
    !nameMarketsStatedAge({
      name: referenceName,
      statedAge: targetCandidate.statedAge,
    })
  ) {
    conflicts.push("stated_age");
  }

  if (
    extractedLabel?.abv !== null &&
    extractedLabel?.abv !== undefined &&
    targetCandidate.abv !== null &&
    targetCandidate.abv !== undefined &&
    extractedLabel.abv !== targetCandidate.abv
  ) {
    conflicts.push("abv");
  }

  if (
    extractedLabel?.vintage_year !== null &&
    extractedLabel?.vintage_year !== undefined &&
    targetCandidate.vintageYear !== null &&
    targetCandidate.vintageYear !== undefined &&
    extractedLabel.vintage_year !== targetCandidate.vintageYear
  ) {
    conflicts.push("vintage_year");
  }

  if (
    extractedLabel?.release_year !== null &&
    extractedLabel?.release_year !== undefined &&
    targetCandidate.releaseYear !== null &&
    targetCandidate.releaseYear !== undefined &&
    extractedLabel.release_year !== targetCandidate.releaseYear
  ) {
    conflicts.push("release_year");
  }

  if (
    extractedLabel?.cask_strength !== null &&
    extractedLabel?.cask_strength !== undefined &&
    targetCandidate.caskStrength !== null &&
    targetCandidate.caskStrength !== undefined &&
    extractedLabel.cask_strength !== targetCandidate.caskStrength
  ) {
    conflicts.push("cask_strength");
  }

  if (
    extractedLabel?.single_cask !== null &&
    extractedLabel?.single_cask !== undefined &&
    targetCandidate.singleCask !== null &&
    targetCandidate.singleCask !== undefined &&
    extractedLabel.single_cask !== targetCandidate.singleCask
  ) {
    conflicts.push("single_cask");
  }

  if (
    extractedLabel?.edition &&
    targetCandidate.edition &&
    !textsOverlap(extractedLabel.edition, targetCandidate.edition)
  ) {
    conflicts.push("edition");
  }

  if (
    extractedLabel?.expression &&
    targetCandidate.fullName &&
    !(
      targetCandidate.statedAge !== null &&
      nameMarketsStatedAge({
        name: extractedLabel.expression,
        statedAge: targetCandidate.statedAge,
      }) &&
      nameMarketsStatedAge({
        name: referenceName,
        statedAge: targetCandidate.statedAge,
      })
    ) &&
    !textsOverlap(extractedLabel.expression, targetCandidate.fullName) &&
    !textsOverlap(extractedLabel.expression, referenceName)
  ) {
    conflicts.push("expression");
  }

  return conflicts;
}
