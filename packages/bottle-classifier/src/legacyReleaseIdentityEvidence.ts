/**
 * Deterministic helpers for interpreting retained legacy release candidates.
 *
 * This module is intentionally narrow. It may only derive legacy release
 * evidence from strong structural markers that are safe to interpret without
 * brand-specific semantics, such as coded `Batch 24` markers or explicit
 * `2011 Release` suffixes.
 *
 * If a split depends on marketed family meaning or brand/program context, this
 * layer must leave the name untouched and let the reviewed classifier decide.
 * Derived data is match evidence only; it never authorizes parent creation,
 * repair, or BottleGroup assignment.
 * New semantic hardcoding requires verified whisky research plus a
 * regression fixture or unit test.
 */
import {
  normalizeBottle,
  normalizeBottleAge,
  normalizeBottleBatchNumber,
  normalizeString,
} from "./normalize";

const GENERIC_FAMILY_NAME_TOKENS = new Set([
  "american",
  "and",
  "bottle",
  "bourbon",
  "canadian",
  "cl",
  "irish",
  "japanese",
  "kentucky",
  "l",
  "malt",
  "ml",
  "of",
  "old",
  "oz",
  "rye",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "straight",
  "the",
  "whiskey",
  "whisky",
  "world",
  "year",
  "years",
  "yr",
  "yrs",
]);
type LegacyReleaseIdentityEvidence = {
  edition: string | null;
  releaseYear: number | null;
  markerSources: string[];
};

function getComparableFamilyNameTokens(fullName: string): string[] {
  return normalizeComparableBottleName(fullName)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(
      (token) => token.length > 0 && !GENERIC_FAMILY_NAME_TOKENS.has(token),
    );
}

function tokenSetsMatchExactly(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  const rightCounts = new Map<string, number>();
  for (const token of right) {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  }

  for (const token of left) {
    const count = rightCounts.get(token) ?? 0;
    if (count === 0) {
      return false;
    }

    if (count === 1) {
      rightCounts.delete(token);
    } else {
      rightCounts.set(token, count - 1);
    }
  }

  return rightCounts.size === 0;
}

function hasExactLegacyReleaseFamilyName(
  leftFullName: string,
  rightFullName: string,
): boolean {
  return leftFullName.toLowerCase() === rightFullName.toLowerCase();
}

export function hasVariantLegacyReleaseFamilyName(
  leftFullName: string,
  rightFullName: string,
): boolean {
  if (hasExactLegacyReleaseFamilyName(leftFullName, rightFullName)) {
    return false;
  }

  return tokenSetsMatchExactly(
    getComparableFamilyNameTokens(leftFullName),
    getComparableFamilyNameTokens(rightFullName),
  );
}

/**
 * Normalizes bottle names for conservative legacy-candidate comparison.
 *
 * This removes only low-risk formatting differences such as batch formatting or
 * age normalization. It must not introduce brand-specific canonicalization.
 */
function normalizeComparableBottleName(fullName: string): string {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  return normalizeBottleAge({ name: normalizedName })
    .name.replace(/\s{2,}/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isReleaseLikeBatchEdition(value: string) {
  const suffix = value
    .replace(/^batch/i, "")
    .replace(/^(?:\s*(?:no\.?|number|#))?/i, "")
    .trim();

  return /^(?:[a-z]*\d[a-z0-9.-]*)$/i.test(suffix);
}

function normalizeEditionToken(value: string) {
  return /^[ivxlcdm]+$/i.test(value) ? value.toUpperCase() : value;
}

function normalizeExplicitEditionMarker(value: string) {
  const normalizedValue = normalizeString(value).trim().replace(/\s+/g, " ");
  const volumeMatch = normalizedValue.match(
    /^Vol(?:ume)?\.?\s+([A-Za-z0-9IVXLCM.-]+)$/i,
  );

  if (volumeMatch) {
    return `Vol. ${normalizeEditionToken(volumeMatch[1])}`;
  }

  const releaseNoMatch = normalizedValue.match(
    /^Release\s+No\.?\s+([A-Za-z0-9.-]+)$/i,
  );

  if (releaseNoMatch) {
    return `Release No. ${normalizeEditionToken(releaseNoMatch[1])}`;
  }

  const bareNoMatch = normalizedValue.match(/^No\.?\s+([A-Za-z0-9.-]+)$/i);

  if (bareNoMatch) {
    return `No. ${normalizeEditionToken(bareNoMatch[1])}`;
  }

  return normalizedValue;
}

function normalizeStrongEditionMarker(value: string) {
  const normalizedValue = normalizeBottleBatchNumber(
    normalizeString(value),
  ).trim();

  if (isReleaseLikeBatchEdition(normalizedValue)) {
    return normalizedValue;
  }

  return normalizeExplicitEditionMarker(normalizedValue);
}

function isStrongStructuredEditionMarker(value: string): boolean {
  const normalizedValue = normalizeStrongEditionMarker(value);

  if (!normalizedValue) {
    return false;
  }

  if (isReleaseLikeBatchEdition(normalizedValue)) {
    return true;
  }

  if (/^\d{4}\s+(?:release|vintage)$/i.test(normalizedValue)) {
    return true;
  }

  if (
    /^(?:vol(?:ume)?\.?\s+[a-z0-9ivxlcdm.-]+|release\s+no\.?\s+[a-z0-9.-]+|no\.?\s+[a-z0-9.-]+)$/i.test(
      normalizedValue,
    )
  ) {
    return true;
  }

  if (
    /^(?:\d+(?:st|nd|rd|th)\s+edition|edition\s+\d+(?:st|nd|rd|th)?|edition\s+[a-z]*\d[a-z0-9#.-]*)$/i.test(
      normalizedValue,
    )
  ) {
    return true;
  }

  return (
    !/\s/.test(normalizedValue) &&
    /^[a-z0-9#.-]+$/i.test(normalizedValue) &&
    /[a-z]/i.test(normalizedValue) &&
    /\d/.test(normalizedValue)
  );
}

function extractInlineBatchEdition(fullName: string): string | null {
  for (const match of fullName.matchAll(/\b(Batch [A-Za-z0-9.-]+)\b/gi)) {
    const matchIndex = match.index ?? 0;
    const prefix = fullName.slice(Math.max(0, matchIndex - 6), matchIndex);

    if (/small\s$/i.test(prefix)) {
      continue;
    }

    if (isReleaseLikeBatchEdition(match[1])) {
      return match[1];
    }
  }

  return null;
}

function extractBatchEdition(fullName: string): string | null {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  const parenthesized = normalizedName.match(/\((Batch [^)]+)\)/i);
  if (parenthesized && isReleaseLikeBatchEdition(parenthesized[1])) {
    return parenthesized[1];
  }

  const inline = extractInlineBatchEdition(normalizedName);
  if (inline) {
    return inline;
  }

  return null;
}

function extractExplicitEditionMarker(fullName: string): string | null {
  const normalizedName = normalizeString(fullName).replace(/\s+/g, " ").trim();
  const releaseNoMatch = normalizedName.match(
    /\b(Release\s+No\.?\s+[A-Za-z0-9.-]+)\b/i,
  );

  if (releaseNoMatch) {
    return normalizeExplicitEditionMarker(releaseNoMatch[1]);
  }

  return null;
}

function buildLooseEditionPattern(edition: string) {
  const normalizedEdition = normalizeStrongEditionMarker(edition);
  const releaseNoMatch = normalizedEdition.match(
    /^Release\s+No\.?\s+([A-Za-z0-9.-]+)$/i,
  );

  if (releaseNoMatch) {
    return `Release\\s+No\\.?\\s+${escapeRegExp(releaseNoMatch[1])}`;
  }

  const bareNoMatch = normalizedEdition.match(/^No\.?\s+([A-Za-z0-9.-]+)$/i);

  if (bareNoMatch) {
    return `(?:Release\\s+)?No\\.?\\s+${escapeRegExp(bareNoMatch[1])}`;
  }

  const volumeMatch = normalizedEdition.match(
    /^Vol(?:ume)?\.?\s+([A-Za-z0-9IVXLCM.-]+)$/i,
  );

  if (volumeMatch) {
    return `Vol(?:ume)?\\.?\\s+${escapeRegExp(volumeMatch[1])}`;
  }

  return escapeRegExp(normalizedEdition).replace(/\\ /g, "\\s+");
}

/**
 * Derives transitional legacy release evidence only from strong structural
 * markers already present in the source name or structured fields.
 *
 * Examples:
 * - `Springbank 12 Cask Strength Batch 24` -> `Batch 24`
 * - `Lagavulin Distillers Edition 2011 Release` -> `2011 Release`
 *
 * Counterexamples that must remain unsplit here:
 * - `Macallan Double Cask`
 * - `Four Roses Single Barrel`
 * - `Maker's Mark Private Selection S2B13`
 */
export function deriveLegacyReleaseIdentityEvidence({
  fullName,
  edition: structuredEdition = null,
  releaseYear: structuredReleaseYear = null,
}: {
  fullName: string;
  edition?: string | null;
  releaseYear?: number | null;
}): LegacyReleaseIdentityEvidence | null {
  const normalizedFullName = normalizeBottleBatchNumber(
    normalizeString(fullName),
  );
  const comparableFullName = normalizeComparableBottleName(normalizedFullName);
  const parsedIdentity = normalizeBottle({ name: normalizedFullName });
  const normalizedStructuredEdition =
    structuredEdition && isStrongStructuredEditionMarker(structuredEdition)
      ? normalizeStrongEditionMarker(structuredEdition)
      : null;
  const edition =
    normalizedStructuredEdition ??
    extractBatchEdition(normalizedFullName) ??
    extractExplicitEditionMarker(normalizedFullName);
  const releaseYear = structuredReleaseYear ?? parsedIdentity.releaseYear;
  const markerSources: string[] = [];

  if (normalizedStructuredEdition) {
    markerSources.push("structured_edition");
  } else if (edition) {
    markerSources.push("name_batch");
  }

  if (structuredReleaseYear) {
    markerSources.push("structured_release_year");
  } else if (parsedIdentity.releaseYear) {
    markerSources.push("name_release_year");
  }

  if (!edition && !releaseYear) {
    return null;
  }

  let familyNameWithoutMarkers = normalizedFullName;

  if (releaseYear !== null) {
    familyNameWithoutMarkers = normalizeBottle({
      name: familyNameWithoutMarkers,
      releaseYear,
    }).name;
  }

  if (edition) {
    const editionPattern = buildLooseEditionPattern(edition);
    const editionPatterns = [
      new RegExp(`\\s*\\(${editionPattern}\\)\\s*$`, "i"),
      new RegExp(`\\s*-\\s*${editionPattern}\\s*$`, "i"),
      new RegExp(`\\s+${editionPattern}\\s*$`, "i"),
    ];

    for (const pattern of editionPatterns) {
      familyNameWithoutMarkers = familyNameWithoutMarkers.replace(pattern, "");
    }
  }

  familyNameWithoutMarkers = familyNameWithoutMarkers
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-,(]+\s*$/g, "")
    .trim();

  if (
    !familyNameWithoutMarkers ||
    normalizeComparableBottleName(familyNameWithoutMarkers).toLowerCase() ===
      comparableFullName.toLowerCase()
  ) {
    return null;
  }

  return {
    edition,
    releaseYear,
    markerSources,
  };
}
