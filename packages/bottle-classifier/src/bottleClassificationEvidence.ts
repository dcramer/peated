import type {
  BottleCandidate,
  BottleExtractedDetails,
  BottleSearchEvidence,
} from "./classifierTypes";
import { listMatchesExpectedValue, textsOverlap } from "./identityEvidenceCore";
import { normalizeBottle } from "./normalize";
import {
  hasAuthoritativeTargetIdentityEvidenceForExistingMatch,
  hasSupportiveWebEvidenceForExistingMatch as hasSharedSupportiveWebEvidenceForExistingMatch,
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

export function hasDirtyParentStatedAgeConflict({
  targetCandidate,
  extractedLabel,
}: {
  targetCandidate: BottleCandidate;
  extractedLabel: BottleExtractedDetails | null | undefined;
}): boolean {
  if (
    !extractedLabel ||
    extractedLabel.stated_age === null ||
    extractedLabel.stated_age === undefined ||
    targetCandidate.kind === "release" ||
    targetCandidate.releaseId !== null ||
    targetCandidate.statedAge === null ||
    targetCandidate.statedAge === extractedLabel.stated_age
  ) {
    return false;
  }

  return !getTargetNameVariants(targetCandidate).some((name) =>
    nameMarketsStatedAge({
      name,
      statedAge: targetCandidate.statedAge,
    }),
  );
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
    extractedLabel.cask_type === null &&
    extractedLabel.cask_size === null &&
    extractedLabel.cask_fill === null &&
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
}: {
  sourceUrl: string;
  searchEvidence: BottleSearchEvidence[];
  extractedLabel: BottleExtractedDetails | null;
  targetCandidate: BottleCandidate | null;
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
    })
  ) {
    return false;
  }

  return hasAuthoritativeTargetIdentityEvidenceForExistingMatch({
    sourceUrl,
    searchEvidence,
    extractedLabel,
    target: targetCandidate,
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
    !hasDirtyParentStatedAgeConflict({
      targetCandidate,
      extractedLabel,
    })
  ) {
    conflicts.push("stated_age");
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
    !textsOverlap(extractedLabel.expression, targetCandidate.fullName) &&
    !textsOverlap(extractedLabel.expression, referenceName)
  ) {
    conflicts.push("expression");
  }

  return conflicts;
}
