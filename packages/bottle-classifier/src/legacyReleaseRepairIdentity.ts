/**
 * Deterministic helpers for legacy release-repair discovery.
 *
 * This module is intentionally narrow. It may only derive parent/release
 * boundaries from strong structural markers that are safe to interpret without
 * brand-specific semantics, such as coded `Batch 24` markers or explicit
 * `2011 Release` suffixes.
 *
 * If a split depends on marketed family meaning or brand/program context, this
 * layer must leave the name untouched and let the reviewed classifier decide.
 */
import type {
  BottleExtractedDetails,
  ProposedRelease,
} from "./classifierTypes";
import {
  normalizeBottle,
  normalizeBottleAge,
  normalizeBottleBatchNumber,
  normalizeString,
} from "./normalize";

export const LEGACY_RELEASE_BATCH_MARKER_PATTERN =
  "batch(?:\\s*(?:no\\.?|number|#))?\\s*(?:[a-z]*\\d[a-z0-9.-]*)";
export const LEGACY_RELEASE_MARKER_PATTERN = `${LEGACY_RELEASE_BATCH_MARKER_PATTERN}|[0-9]{4}\\s+release`;

const GENERIC_PARENT_NAME_TOKENS = new Set([
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
const DISTINCT_CATEGORY_NAME_MARKERS = [
  "bourbon",
  "rye",
  "scotch",
  "irish",
  "japanese",
  "canadian",
] as const;

export type LegacyReleaseRepairParentCandidate = {
  abv: null | number;
  category: BottleExtractedDetails["category"];
  caskFill: ProposedRelease["caskFill"];
  caskSize: ProposedRelease["caskSize"];
  caskStrength: null | boolean;
  caskType: ProposedRelease["caskType"];
  edition: null | string;
  fullName: string;
  id: number;
  releaseYear: null | number;
  singleCask: null | boolean;
  statedAge: null | number;
  totalTastings: null | number;
  vintageYear: null | number;
};

export type LegacyReleaseRepairIdentity = {
  proposedParentFullName: string;
  edition: string | null;
  releaseYear: number | null;
  markerSources: string[];
};

export type LegacyReleaseRepairParentMode =
  | "existing_parent"
  | "create_parent"
  | "blocked_alias_conflict"
  | "blocked_dirty_parent";

export type LegacyReleaseRepairParentMatchType = "exact" | "variant";

const LEGACY_RELEASE_DIRTY_PARENT_NAME_PATTERN = new RegExp(
  `\\b(?:${LEGACY_RELEASE_MARKER_PATTERN}|[0-9]{4}\\s+vintage)\\b`,
  "i",
);

function getComparableParentNameTokens(fullName: string): string[] {
  return normalizeComparableBottleName(fullName)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(
      (token) => token.length > 0 && !GENERIC_PARENT_NAME_TOKENS.has(token),
    );
}

function getDistinctCategoryNameMarkers(fullName: string) {
  const normalizedFullName = normalizeString(fullName).toLowerCase();

  return DISTINCT_CATEGORY_NAME_MARKERS.filter((marker) =>
    normalizedFullName.match(new RegExp(`\\b${marker}\\b`, "i")),
  );
}

function hasConflictingCategoryNameMarkers(
  sourceFullName: string,
  targetFullName: string,
) {
  const sourceMarkers = getDistinctCategoryNameMarkers(sourceFullName);
  const targetMarkers = getDistinctCategoryNameMarkers(targetFullName);

  return (
    sourceMarkers.length > 0 &&
    targetMarkers.length > 0 &&
    !sourceMarkers.some((marker) => targetMarkers.includes(marker))
  );
}

function tokenSetsMatchExactly(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) {
    return false;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const token of leftSet) {
    if (!rightSet.has(token)) {
      return false;
    }
  }

  return true;
}

function getTastingCount(value: null | number | undefined): number {
  return value ?? 0;
}

function hasExactLegacyReleaseRepairParentName(
  fullName: string,
  proposedParentFullName: string,
): boolean {
  return fullName.toLowerCase() === proposedParentFullName.toLowerCase();
}

function canReuseLegacyReleaseRepairParent(
  row: LegacyReleaseRepairParentCandidate,
  {
    proposedParentFullName,
  }: {
    proposedParentFullName: string;
  },
) {
  if (hasConflictingCategoryNameMarkers(row.fullName, proposedParentFullName)) {
    return false;
  }

  return true;
}

export function hasVariantLegacyReleaseRepairParentName(
  fullName: string,
  proposedParentFullName: string,
): boolean {
  if (hasExactLegacyReleaseRepairParentName(fullName, proposedParentFullName)) {
    return false;
  }

  return tokenSetsMatchExactly(
    getComparableParentNameTokens(fullName),
    getComparableParentNameTokens(proposedParentFullName),
  );
}

export function pickBestLegacyReleaseRepairParent<
  TRow extends LegacyReleaseRepairParentCandidate,
>(rows: TRow[]): null | TRow {
  let bestRow: null | TRow = null;

  for (const row of rows) {
    if (hasDirtyLegacyReleaseRepairParent(row)) {
      continue;
    }

    if (
      !bestRow ||
      getTastingCount(row.totalTastings) >
        getTastingCount(bestRow.totalTastings)
    ) {
      bestRow = row;
    }
  }

  return bestRow;
}

function pickBestDirtyLegacyReleaseRepairParent<
  TRow extends LegacyReleaseRepairParentCandidate,
>(rows: TRow[]): null | TRow {
  let bestRow: null | TRow = null;

  for (const row of rows) {
    if (!hasDirtyLegacyReleaseRepairParent(row)) {
      continue;
    }

    if (
      !bestRow ||
      getTastingCount(row.totalTastings) >
        getTastingCount(bestRow.totalTastings)
    ) {
      bestRow = row;
    }
  }

  return bestRow;
}

export function resolveLegacyReleaseRepairParentMatch<
  TRow extends LegacyReleaseRepairParentCandidate,
>(
  rows: TRow[],
  {
    currentLegacyBottleId,
    proposedParentFullName,
  }: {
    currentLegacyBottleId?: number;
    proposedParentFullName: string;
  },
): {
  exactParent: null | TRow;
  exactRows: TRow[];
  matchType: LegacyReleaseRepairParentMatchType | null;
  parent: null | TRow;
  variantParent: null | TRow;
  variantRows: TRow[];
} {
  const candidateRows = rows.filter(
    (row) =>
      (currentLegacyBottleId === undefined ||
        row.id !== currentLegacyBottleId) &&
      canReuseLegacyReleaseRepairParent(row, {
        proposedParentFullName,
      }),
  );
  const exactRows = candidateRows.filter((row) =>
    hasExactLegacyReleaseRepairParentName(row.fullName, proposedParentFullName),
  );
  const exactParent = pickBestLegacyReleaseRepairParent(exactRows);

  if (exactParent) {
    return {
      exactParent,
      exactRows,
      matchType: "exact",
      parent: exactParent,
      variantParent: null,
      variantRows: [],
    };
  }

  const variantRows = candidateRows.filter((row) =>
    hasVariantLegacyReleaseRepairParentName(
      row.fullName,
      proposedParentFullName,
    ),
  );
  const variantParent = pickBestLegacyReleaseRepairParent(variantRows);

  return {
    exactParent: null,
    exactRows,
    matchType: variantParent ? "variant" : null,
    parent: variantParent,
    variantParent,
    variantRows,
  };
}

export function getLegacyReleaseRepairParentMode<
  TRow extends LegacyReleaseRepairParentCandidate,
>(
  rows: TRow[],
  {
    currentLegacyBottleId,
    parentAlias,
    proposedParentFullName,
  }: {
    currentLegacyBottleId?: number;
    parentAlias?: {
      bottleId: number | null;
      releaseId: number | null;
    } | null;
    proposedParentFullName: string;
  },
): LegacyReleaseRepairParentMode {
  const parentMatch = resolveLegacyReleaseRepairParentMatch(rows, {
    currentLegacyBottleId,
    proposedParentFullName,
  });

  if (parentMatch.exactParent) {
    return "existing_parent";
  }

  if (
    parentMatch.exactRows.some((row) => hasDirtyLegacyReleaseRepairParent(row))
  ) {
    return "blocked_dirty_parent";
  }

  if (parentMatch.variantParent) {
    return "existing_parent";
  }

  if (
    parentMatch.variantRows.some((row) =>
      hasDirtyLegacyReleaseRepairParent(row),
    )
  ) {
    return "blocked_dirty_parent";
  }

  if (
    parentAlias &&
    (parentAlias.bottleId !== null || parentAlias.releaseId !== null) &&
    parentAlias.bottleId !== currentLegacyBottleId
  ) {
    return "blocked_alias_conflict";
  }

  return "create_parent";
}

export function getLegacyReleaseRepairBlockingParent<
  TRow extends LegacyReleaseRepairParentCandidate,
>(
  rows: TRow[],
  {
    currentLegacyBottleId,
    proposedParentFullName,
  }: {
    currentLegacyBottleId?: number;
    proposedParentFullName: string;
  },
): null | TRow {
  const parentMatch = resolveLegacyReleaseRepairParentMatch(rows, {
    currentLegacyBottleId,
    proposedParentFullName,
  });

  return (
    pickBestDirtyLegacyReleaseRepairParent(parentMatch.exactRows) ??
    pickBestDirtyLegacyReleaseRepairParent(parentMatch.variantRows)
  );
}

export function hasDirtyLegacyReleaseRepairParent(
  row: Pick<
    LegacyReleaseRepairParentCandidate,
    "edition" | "fullName" | "releaseYear" | "vintageYear"
  >,
) {
  return Boolean(
    row.edition ||
    row.releaseYear ||
    row.vintageYear ||
    LEGACY_RELEASE_DIRTY_PARENT_NAME_PATTERN.test(
      normalizeString(row.fullName),
    ),
  );
}

/**
 * Normalizes bottle names for conservative parent matching.
 *
 * This removes only low-risk formatting differences such as batch formatting or
 * age normalization. It must not introduce brand-specific canonicalization.
 */
export function normalizeComparableBottleName(fullName: string): string {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  return normalizeBottleAge({ name: normalizedName })
    .name.replace(/\s{2,}/g, " ")
    .trim();
}

function extractBatchEdition(fullName: string): string | null {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  const isReleaseLikeBatchEdition = (value: string) => {
    const suffix = value
      .replace(/^batch/i, "")
      .replace(/^(?:\s*(?:no\.?|number|#))?/i, "")
      .trim();

    return /^(?:[a-z]*\d[a-z0-9.-]*)$/i.test(suffix);
  };
  const parenthesized = normalizedName.match(/\((Batch [^)]+)\)/i);
  if (parenthesized && isReleaseLikeBatchEdition(parenthesized[1])) {
    return parenthesized[1];
  }

  const inline = normalizedName.match(/\b(Batch [A-Za-z0-9.-]+)\b/i);
  if (inline && isReleaseLikeBatchEdition(inline[1])) {
    return inline[1];
  }

  return null;
}

/**
 * Derives a release repair identity only from strong structural release
 * markers already present in the source name or structured fields.
 *
 * Examples:
 * - `Springbank 12 Cask Strength Batch 24` -> parent + `Batch 24`
 * - `Lagavulin Distillers Edition 2011 Release` -> parent + `2011 Release`
 *
 * Counterexamples that must remain unsplit here:
 * - `Macallan Double Cask`
 * - `Four Roses Single Barrel`
 * - `Maker's Mark Private Selection S2B13`
 */
export function deriveLegacyReleaseRepairIdentity({
  fullName,
  edition: structuredEdition = null,
  releaseYear: structuredReleaseYear = null,
}: {
  fullName: string;
  edition?: string | null;
  releaseYear?: number | null;
}): LegacyReleaseRepairIdentity | null {
  const normalizedFullName = normalizeBottleBatchNumber(
    normalizeString(fullName),
  );
  const comparableFullName = normalizeComparableBottleName(normalizedFullName);
  const parsedIdentity = normalizeBottle({ name: normalizedFullName });
  const edition = structuredEdition ?? extractBatchEdition(normalizedFullName);
  const releaseYear = structuredReleaseYear ?? parsedIdentity.releaseYear;
  const markerSources: string[] = [];

  if (structuredEdition) {
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

  let proposedParentFullName = normalizedFullName;

  if (releaseYear !== null) {
    proposedParentFullName = normalizeBottle({
      name: proposedParentFullName,
      releaseYear,
    }).name;
  }

  if (edition) {
    const escapedEdition = edition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const editionPatterns = [
      new RegExp(`\\s*\\(${escapedEdition}\\)\\s*$`, "i"),
      new RegExp(`\\s*-\\s*${escapedEdition}\\s*$`, "i"),
      new RegExp(`\\s+${escapedEdition}\\s*$`, "i"),
    ];

    for (const pattern of editionPatterns) {
      proposedParentFullName = proposedParentFullName.replace(pattern, "");
    }
  }

  proposedParentFullName = proposedParentFullName
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-,(]+\s*$/g, "")
    .trim();

  if (
    !proposedParentFullName ||
    normalizeComparableBottleName(proposedParentFullName).toLowerCase() ===
      comparableFullName.toLowerCase()
  ) {
    return null;
  }

  return {
    proposedParentFullName,
    edition,
    releaseYear,
    markerSources,
  };
}

/**
 * Determines whether a raw name still belongs to the parent bottle scope or to
 * the derived release scope after a deterministic split.
 */
export function resolveLegacyReleaseRepairNameScope({
  name,
  proposedParentFullName,
  releaseIdentity,
}: {
  name: string;
  proposedParentFullName: string;
  releaseIdentity: {
    edition: string | null;
    releaseYear: number | null;
  };
}): "parent" | "release" {
  const comparableName = normalizeComparableBottleName(name).toLowerCase();
  const comparableParentName = normalizeComparableBottleName(
    proposedParentFullName,
  ).toLowerCase();

  if (comparableName === comparableParentName) {
    return "parent";
  }

  const derivedIdentity = deriveLegacyReleaseRepairIdentity({
    fullName: name,
  });

  if (!derivedIdentity) {
    return "parent";
  }

  const derivedParentName = normalizeComparableBottleName(
    derivedIdentity.proposedParentFullName,
  ).toLowerCase();

  if (derivedParentName !== comparableParentName) {
    return "parent";
  }

  const hasMatchingEdition =
    derivedIdentity.edition !== null &&
    derivedIdentity.edition === releaseIdentity.edition;
  const hasMatchingReleaseYear =
    derivedIdentity.releaseYear !== null &&
    derivedIdentity.releaseYear === releaseIdentity.releaseYear;
  const hasConflictingEdition =
    derivedIdentity.edition !== null &&
    releaseIdentity.edition !== null &&
    derivedIdentity.edition !== releaseIdentity.edition;
  const hasConflictingReleaseYear =
    derivedIdentity.releaseYear !== null &&
    releaseIdentity.releaseYear !== null &&
    derivedIdentity.releaseYear !== releaseIdentity.releaseYear;

  if (hasConflictingEdition || hasConflictingReleaseYear) {
    return "parent";
  }

  if (hasMatchingEdition || hasMatchingReleaseYear) {
    return "release";
  }

  return "parent";
}
