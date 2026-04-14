import { hasVariantLegacyReleaseRepairParentName } from "@peated/bottle-classifier/legacyReleaseRepairIdentity";
import { db } from "@peated/server/db";
import { bottles, type Bottle } from "@peated/server/db/schema";
import { hasBottleLevelReleaseTraits } from "@peated/server/lib/bottleSchemaRules";
import { normalizeString } from "@peated/server/lib/normalize";
import { desc, eq, sql } from "drizzle-orm";

const MAX_SCAN_LIMIT = 2000;

type CanonRepairBottle = Pick<
  Bottle,
  | "abv"
  | "id"
  | "brandId"
  | "bottlerId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "category"
  | "edition"
  | "fullName"
  | "name"
  | "numReleases"
  | "releaseYear"
  | "seriesId"
  | "singleCask"
  | "statedAge"
  | "totalTastings"
  | "vintageYear"
>;

export type CanonRepairCandidate = {
  bottle: {
    id: number;
    fullName: string;
    numReleases: number;
    totalTastings: null | number;
  };
  targetBottle: {
    id: number;
    fullName: string;
    numReleases: number;
    totalTastings: null | number;
  };
  variantBottles: Array<{
    id: number;
    fullName: string;
    numReleases: number;
    totalTastings: null | number;
  }>;
};

function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function getTastingCount(value: null | number | undefined): number {
  return value ?? 0;
}

function getNormalizedWordCount(fullName: string): number {
  return normalizeString(fullName).split(/\s+/).filter(Boolean).length;
}

function compareCanonRepairTargetQuality(
  left: Pick<CanonRepairBottle, "fullName" | "id" | "totalTastings">,
  right: Pick<CanonRepairBottle, "fullName" | "id" | "totalTastings">,
): number {
  const wordDiff =
    getNormalizedWordCount(left.fullName) -
    getNormalizedWordCount(right.fullName);
  if (wordDiff !== 0) {
    return wordDiff;
  }

  const charDiff =
    normalizeString(left.fullName).length -
    normalizeString(right.fullName).length;
  if (charDiff !== 0) {
    return charDiff;
  }

  const tastingDiff =
    getTastingCount(right.totalTastings) - getTastingCount(left.totalTastings);
  if (tastingDiff !== 0) {
    return tastingDiff;
  }

  return left.id - right.id;
}

function hasConflictingValue<TValue>(
  left: null | TValue,
  right: null | TValue,
): boolean {
  return left !== null && right !== null && left !== right;
}

const DISTINCT_CATEGORY_NAME_MARKERS = [
  "bourbon",
  "rye",
  "scotch",
  "irish",
  "japanese",
  "canadian",
] as const;

function getDistinctCategoryNameMarkers(fullName: string) {
  const normalizedFullName = normalizeString(fullName).toLowerCase();

  return DISTINCT_CATEGORY_NAME_MARKERS.filter((marker) =>
    normalizedFullName.match(new RegExp(`\\b${marker}\\b`, "i")),
  );
}

function hasConflictingCategoryNameMarkers(
  source: Pick<CanonRepairBottle, "fullName">,
  target: Pick<CanonRepairBottle, "fullName">,
) {
  const sourceMarkers = getDistinctCategoryNameMarkers(source.fullName);
  const targetMarkers = getDistinctCategoryNameMarkers(target.fullName);

  return (
    sourceMarkers.length > 0 &&
    targetMarkers.length > 0 &&
    !sourceMarkers.some((marker) => targetMarkers.includes(marker))
  );
}

function canCanonRepairPair(
  source: CanonRepairBottle,
  target: CanonRepairBottle,
) {
  if (source.id === target.id || source.brandId !== target.brandId) {
    return false;
  }

  if (
    hasBottleLevelReleaseTraits(source) ||
    hasBottleLevelReleaseTraits(target) ||
    !hasVariantLegacyReleaseRepairParentName(source.fullName, target.fullName)
  ) {
    return false;
  }

  if (
    hasConflictingValue(source.category, target.category) ||
    hasConflictingValue(source.bottlerId, target.bottlerId) ||
    hasConflictingValue(source.seriesId, target.seriesId) ||
    hasConflictingValue(source.statedAge, target.statedAge) ||
    hasConflictingCategoryNameMarkers(source, target)
  ) {
    return false;
  }

  return true;
}

function canonRepairCandidateMatchesQuery(
  candidate: CanonRepairCandidate,
  normalizedQuery: string,
) {
  return [
    candidate.bottle.fullName,
    candidate.targetBottle.fullName,
    ...candidate.variantBottles.map((variant) => variant.fullName),
  ].some((name) =>
    normalizeString(name).toLowerCase().includes(normalizedQuery),
  );
}

export async function getCanonRepairCandidates({
  query = "",
  cursor = 1,
  limit = 25,
}: {
  cursor?: number;
  limit?: number;
  query?: string;
}) {
  const baseQuery = db
    .select({
      id: bottles.id,
      brandId: bottles.brandId,
      bottlerId: bottles.bottlerId,
      abv: bottles.abv,
      caskFill: bottles.caskFill,
      caskSize: bottles.caskSize,
      caskStrength: bottles.caskStrength,
      caskType: bottles.caskType,
      category: bottles.category,
      edition: bottles.edition,
      fullName: bottles.fullName,
      name: bottles.name,
      numReleases: bottles.numReleases,
      releaseYear: bottles.releaseYear,
      seriesId: bottles.seriesId,
      singleCask: bottles.singleCask,
      statedAge: bottles.statedAge,
      totalTastings: bottles.totalTastings,
      vintageYear: bottles.vintageYear,
    })
    .from(bottles);

  const normalizedQuery = normalizeString(query).toLowerCase().trim();
  let rows: CanonRepairBottle[];

  if (normalizedQuery) {
    const queryRows = await baseQuery
      .where(
        sql`${bottles.fullName} ILIKE ${`%${escapeLikePattern(query)}%`} ESCAPE '\\'`,
      )
      .orderBy(desc(bottles.totalTastings), desc(bottles.id))
      .limit(MAX_SCAN_LIMIT);

    if (queryRows.length === 0) {
      return {
        results: [],
        rel: {
          nextCursor: null,
          prevCursor: cursor > 1 ? cursor - 1 : null,
        },
      };
    }

    const rowsById = new Map<number, CanonRepairBottle>();
    for (const row of queryRows) {
      rowsById.set(row.id, row);
    }

    for (const brandId of new Set(queryRows.map((row) => row.brandId))) {
      const brandRows = await baseQuery
        .where(eq(bottles.brandId, brandId))
        .orderBy(desc(bottles.totalTastings), desc(bottles.id))
        .limit(MAX_SCAN_LIMIT);

      for (const row of brandRows) {
        rowsById.set(row.id, row);
      }
    }

    rows = Array.from(rowsById.values()).sort((left, right) => {
      const tastingDiff =
        getTastingCount(right.totalTastings) -
        getTastingCount(left.totalTastings);
      if (tastingDiff !== 0) {
        return tastingDiff;
      }

      return right.id - left.id;
    });
  } else {
    rows = await baseQuery
      .orderBy(desc(bottles.totalTastings), desc(bottles.id))
      .limit(MAX_SCAN_LIMIT);
  }

  const brandGroups = new Map<number, CanonRepairBottle[]>();
  for (const row of rows) {
    const existingRows = brandGroups.get(row.brandId) ?? [];
    existingRows.push(row);
    brandGroups.set(row.brandId, existingRows);
  }

  const candidates: CanonRepairCandidate[] = [];

  for (const row of rows) {
    if (hasBottleLevelReleaseTraits(row)) {
      continue;
    }

    const brandRows = brandGroups.get(row.brandId) ?? [];
    const variantRows = brandRows.filter((candidate) =>
      canCanonRepairPair(row, candidate),
    );

    if (variantRows.length === 0) {
      continue;
    }

    const sortedVariantRows = [...variantRows].sort(
      compareCanonRepairTargetQuality,
    );
    const [bestTarget] = sortedVariantRows;

    if (!bestTarget || compareCanonRepairTargetQuality(bestTarget, row) >= 0) {
      continue;
    }

    candidates.push({
      bottle: {
        id: row.id,
        fullName: row.fullName,
        numReleases: row.numReleases,
        totalTastings: row.totalTastings,
      },
      targetBottle: {
        id: bestTarget.id,
        fullName: bestTarget.fullName,
        numReleases: bestTarget.numReleases,
        totalTastings: bestTarget.totalTastings,
      },
      variantBottles: sortedVariantRows
        .filter((candidate) => candidate.id !== bestTarget.id)
        .map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          numReleases: candidate.numReleases,
          totalTastings: candidate.totalTastings,
        })),
    });
  }

  candidates.sort((left, right) => {
    const tastingDiff =
      getTastingCount(right.bottle.totalTastings) -
      getTastingCount(left.bottle.totalTastings);
    if (tastingDiff !== 0) {
      return tastingDiff;
    }

    return right.bottle.id - left.bottle.id;
  });

  const filteredCandidates = normalizedQuery
    ? candidates.filter((candidate) =>
        canonRepairCandidateMatchesQuery(candidate, normalizedQuery),
      )
    : candidates;

  const start = Math.max(0, (cursor - 1) * limit);
  const results = filteredCandidates.slice(start, start + limit);
  const nextCursor =
    start + limit < filteredCandidates.length ? cursor + 1 : null;
  const prevCursor = cursor > 1 ? cursor - 1 : null;

  return {
    results,
    rel: {
      nextCursor,
      prevCursor,
    },
  };
}
