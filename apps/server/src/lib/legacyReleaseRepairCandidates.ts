import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  type Bottle,
} from "@peated/server/db/schema";
import { hasBottleLevelReleaseTraits } from "@peated/server/lib/bottleSchemaRules";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  normalizeBottle,
  normalizeBottleAge,
  normalizeBottleBatchNumber,
  normalizeString,
} from "./normalize";

const LEGACY_RELEASE_MARKER_PATTERN = "batch|[0-9]{4}\\s+release";
const MAX_SCAN_LIMIT = 2000;
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

type LegacyReleaseRepairBottle = Omit<
  Pick<
    Bottle,
    | "id"
    | "brandId"
    | "category"
    | "fullName"
    | "edition"
    | "releaseYear"
    | "numReleases"
    | "totalTastings"
  >,
  "totalTastings"
> & {
  totalTastings: null | number;
};

export type LegacyReleaseRepairParentCandidate = Pick<
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
  | "totalTastings"
  | "vintageYear"
>;

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

type LegacyReleaseRepairParentMatchType = "exact" | "variant";

export type DerivedLegacyReleaseRepairCandidate =
  LegacyReleaseRepairIdentity & {
    bottle: LegacyReleaseRepairBottle;
  };

export type LegacyReleaseRepairCandidate = {
  blockingAlias: null | {
    bottleFullName: string | null;
    bottleId: number | null;
    name: string;
    releaseFullName: string | null;
    releaseId: number | null;
  };
  blockingParent: null | {
    id: number;
    fullName: string;
    totalTastings: number | null;
  };
  legacyBottle: LegacyReleaseRepairBottle;
  proposedParent: {
    id: number | null;
    fullName: string;
    totalTastings: number | null;
  };
  releaseIdentity: {
    edition: string | null;
    releaseYear: number | null;
    markerSources: string[];
  };
  siblingLegacyBottles: Array<{
    id: number;
    fullName: string;
  }>;
  hasExactParent: boolean;
  repairMode: LegacyReleaseRepairParentMode;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function getTastingCount(value: null | number | undefined): number {
  return value ?? 0;
}

function hasConflictingValue<TValue>(
  left: null | TValue,
  right: null | TValue,
): boolean {
  return left !== null && right !== null && left !== right;
}

function getLegacyReleaseRepairModePriority(
  value: LegacyReleaseRepairParentMode,
): number {
  switch (value) {
    case "existing_parent":
      return 0;
    case "create_parent":
      return 1;
    case "blocked_alias_conflict":
      return 2;
    case "blocked_dirty_parent":
      return 3;
  }
}

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
    sourceCategory,
  }: {
    proposedParentFullName: string;
    sourceCategory: Bottle["category"];
  },
) {
  if (hasConflictingValue(row.category, sourceCategory)) {
    return false;
  }

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
    if (hasBottleLevelReleaseTraits(row)) {
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
    if (!hasBottleLevelReleaseTraits(row)) {
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
    sourceCategory,
  }: {
    currentLegacyBottleId?: number;
    proposedParentFullName: string;
    sourceCategory: Bottle["category"];
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
        sourceCategory,
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
    sourceCategory,
  }: {
    currentLegacyBottleId?: number;
    parentAlias?: {
      bottleId: number | null;
      releaseId: number | null;
    } | null;
    proposedParentFullName: string;
    sourceCategory: Bottle["category"];
  },
): LegacyReleaseRepairParentMode {
  const parentMatch = resolveLegacyReleaseRepairParentMatch(rows, {
    currentLegacyBottleId,
    proposedParentFullName,
    sourceCategory,
  });

  if (parentMatch.exactParent) {
    return "existing_parent";
  }

  if (parentMatch.exactRows.some((row) => hasBottleLevelReleaseTraits(row))) {
    return "blocked_dirty_parent";
  }

  if (parentMatch.variantParent) {
    return "existing_parent";
  }

  if (parentMatch.variantRows.some((row) => hasBottleLevelReleaseTraits(row))) {
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
    sourceCategory,
  }: {
    currentLegacyBottleId?: number;
    proposedParentFullName: string;
    sourceCategory: Bottle["category"];
  },
): null | TRow {
  const parentMatch = resolveLegacyReleaseRepairParentMatch(rows, {
    currentLegacyBottleId,
    proposedParentFullName,
    sourceCategory,
  });

  return (
    pickBestDirtyLegacyReleaseRepairParent(parentMatch.exactRows) ??
    pickBestDirtyLegacyReleaseRepairParent(parentMatch.variantRows)
  );
}

export function normalizeComparableBottleName(fullName: string): string {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  return normalizeBottleAge({ name: normalizedName })
    .name.replace(/\s{2,}/g, " ")
    .trim();
}

function extractBatchEdition(fullName: string): string | null {
  const normalizedName = normalizeBottleBatchNumber(normalizeString(fullName));
  const parenthesized = normalizedName.match(/\((Batch [^)]+)\)/i);
  if (parenthesized) {
    return parenthesized[1];
  }

  const inline = normalizedName.match(/\b(Batch [A-Za-z0-9.-]+)\b/i);
  return inline?.[1] ?? null;
}

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
    const escapedEdition = escapeRegExp(edition);
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

export function deriveLegacyReleaseRepairCandidate(
  bottle: LegacyReleaseRepairBottle,
): DerivedLegacyReleaseRepairCandidate | null {
  const repairIdentity = deriveLegacyReleaseRepairIdentity({
    fullName: bottle.fullName,
    edition: bottle.edition,
    releaseYear: bottle.releaseYear,
  });

  if (!repairIdentity) {
    return null;
  }

  return {
    bottle,
    ...repairIdentity,
  };
}

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

export async function getLegacyReleaseRepairCandidates({
  query = "",
  cursor = 1,
  limit = 25,
}: {
  query?: string;
  cursor?: number;
  limit?: number;
}) {
  const suspiciousBottles = await db
    .select({
      id: bottles.id,
      brandId: bottles.brandId,
      category: bottles.category,
      fullName: bottles.fullName,
      edition: bottles.edition,
      releaseYear: bottles.releaseYear,
      numReleases: sql<number>`COALESCE(${bottles.numReleases}, 0)::integer`,
      totalTastings: bottles.totalTastings,
    })
    .from(bottles)
    .where(
      and(
        or(eq(bottles.numReleases, 0), isNull(bottles.numReleases)),
        or(
          isNotNull(bottles.edition),
          isNotNull(bottles.releaseYear),
          sql`LOWER(${bottles.fullName}) ~ ${LEGACY_RELEASE_MARKER_PATTERN}`,
        ),
        query
          ? sql`${bottles.fullName} ILIKE ${`%${escapeLikePattern(query)}%`} ESCAPE '\\'`
          : undefined,
      ),
    )
    .orderBy(sql`${bottles.totalTastings} DESC NULLS LAST`, desc(bottles.id))
    .limit(MAX_SCAN_LIMIT);

  const derivedCandidates = suspiciousBottles
    .map((bottle) => deriveLegacyReleaseRepairCandidate(bottle))
    .filter((candidate): candidate is DerivedLegacyReleaseRepairCandidate =>
      Boolean(candidate),
    );

  if (derivedCandidates.length === 0) {
    return {
      results: [],
      rel: {
        nextCursor: null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  }

  const groupedCandidates = new Map<
    string,
    DerivedLegacyReleaseRepairCandidate[]
  >();
  const brandIds = new Set<number>();
  const parentNames = new Set<string>();
  for (const candidate of derivedCandidates) {
    const parentKey = candidate.proposedParentFullName.toLowerCase();
    brandIds.add(candidate.bottle.brandId);
    parentNames.add(parentKey);
    const group = groupedCandidates.get(parentKey) ?? [];
    group.push(candidate);
    groupedCandidates.set(parentKey, group);
  }

  const parentRows =
    parentNames.size > 0
      ? await db
          .select({
            id: bottles.id,
            fullName: bottles.fullName,
            category: bottles.category,
            totalTastings: bottles.totalTastings,
            edition: bottles.edition,
            releaseYear: bottles.releaseYear,
            vintageYear: bottles.vintageYear,
            abv: bottles.abv,
            singleCask: bottles.singleCask,
            caskStrength: bottles.caskStrength,
            caskFill: bottles.caskFill,
            caskType: bottles.caskType,
            caskSize: bottles.caskSize,
          })
          .from(bottles)
          .where(
            sql`LOWER(${bottles.fullName}) IN (${sql.join(
              Array.from(parentNames).map((name) => sql`${name}`),
              sql`, `,
            )})`,
          )
      : [];
  const brandParentRows =
    brandIds.size > 0
      ? await db
          .select({
            brandId: bottles.brandId,
            id: bottles.id,
            fullName: bottles.fullName,
            category: bottles.category,
            totalTastings: bottles.totalTastings,
            edition: bottles.edition,
            releaseYear: bottles.releaseYear,
            vintageYear: bottles.vintageYear,
            abv: bottles.abv,
            singleCask: bottles.singleCask,
            caskStrength: bottles.caskStrength,
            caskFill: bottles.caskFill,
            caskType: bottles.caskType,
            caskSize: bottles.caskSize,
          })
          .from(bottles)
          .where(
            sql`${bottles.brandId} IN (${sql.join(
              Array.from(brandIds).map((brandId) => sql`${brandId}`),
              sql`, `,
            )})`,
          )
      : [];
  const parentAliasRows =
    parentNames.size > 0
      ? await db
          .select({
            name: bottleAliases.name,
            bottleId: bottleAliases.bottleId,
            releaseId: bottleAliases.releaseId,
          })
          .from(bottleAliases)
          .where(
            sql`LOWER(${bottleAliases.name}) IN (${sql.join(
              Array.from(parentNames).map((name) => sql`${name}`),
              sql`, `,
            )})`,
          )
      : [];

  const parentRowsByName = new Map<string, typeof parentRows>();
  const brandParentRowsByBrandId = new Map<number, typeof brandParentRows>();
  const parentAliasByName = new Map<
    string,
    {
      bottleFullName: string | null;
      bottleId: number | null;
      releaseFullName: string | null;
      releaseId: number | null;
    }
  >();

  const aliasBottleIds = Array.from(
    new Set(
      parentAliasRows
        .map((row) => row.bottleId)
        .filter((value): value is number => value !== null),
    ),
  );
  const aliasReleaseIds = Array.from(
    new Set(
      parentAliasRows
        .map((row) => row.releaseId)
        .filter((value): value is number => value !== null),
    ),
  );
  const aliasBottleRows =
    aliasBottleIds.length > 0
      ? await db
          .select({
            fullName: bottles.fullName,
            id: bottles.id,
          })
          .from(bottles)
          .where(
            sql`${bottles.id} IN (${sql.join(
              aliasBottleIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];
  const aliasReleaseRows =
    aliasReleaseIds.length > 0
      ? await db
          .select({
            fullName: bottleReleases.fullName,
            id: bottleReleases.id,
          })
          .from(bottleReleases)
          .where(
            sql`${bottleReleases.id} IN (${sql.join(
              aliasReleaseIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];
  const aliasBottleFullNameById = new Map(
    aliasBottleRows.map((row) => [row.id, row.fullName]),
  );
  const aliasReleaseFullNameById = new Map(
    aliasReleaseRows.map((row) => [row.id, row.fullName]),
  );

  for (const row of parentRows) {
    const key = row.fullName.toLowerCase();
    const group = parentRowsByName.get(key) ?? [];
    group.push(row);
    parentRowsByName.set(key, group);
  }
  for (const row of brandParentRows) {
    const group = brandParentRowsByBrandId.get(row.brandId) ?? [];
    group.push(row);
    brandParentRowsByBrandId.set(row.brandId, group);
  }
  for (const row of parentAliasRows) {
    parentAliasByName.set(row.name.toLowerCase(), {
      bottleFullName:
        row.bottleId !== null
          ? (aliasBottleFullNameById.get(row.bottleId) ?? null)
          : null,
      bottleId: row.bottleId,
      releaseFullName:
        row.releaseId !== null
          ? (aliasReleaseFullNameById.get(row.releaseId) ?? null)
          : null,
      releaseId: row.releaseId,
    });
  }

  const filteredCandidates = derivedCandidates
    .map((candidate) => {
      const parentKey = candidate.proposedParentFullName.toLowerCase();
      const siblings =
        groupedCandidates
          .get(parentKey)
          ?.filter((sibling) => sibling.bottle.id !== candidate.bottle.id)
          .map((sibling) => ({
            id: sibling.bottle.id,
            fullName: sibling.bottle.fullName,
          })) ?? [];
      const parentRowsForName = parentRowsByName.get(parentKey) ?? [];
      const brandRowsForBottle =
        brandParentRowsByBrandId.get(candidate.bottle.brandId) ?? [];
      const parentRowsForCandidate = Array.from(
        new Map(
          [...parentRowsForName, ...brandRowsForBottle].map((row) => [
            row.id,
            row,
          ]),
        ).values(),
      );
      const parentAlias = parentAliasByName.get(parentKey) ?? null;
      const parentMatch = resolveLegacyReleaseRepairParentMatch(
        parentRowsForCandidate,
        {
          currentLegacyBottleId: candidate.bottle.id,
          proposedParentFullName: candidate.proposedParentFullName,
          sourceCategory: candidate.bottle.category,
        },
      );
      const parent = parentMatch.parent;
      const blockingParent = getLegacyReleaseRepairBlockingParent(
        parentRowsForCandidate,
        {
          currentLegacyBottleId: candidate.bottle.id,
          proposedParentFullName: candidate.proposedParentFullName,
          sourceCategory: candidate.bottle.category,
        },
      );
      const repairMode = getLegacyReleaseRepairParentMode(
        parentRowsForCandidate,
        {
          currentLegacyBottleId: candidate.bottle.id,
          parentAlias,
          proposedParentFullName: candidate.proposedParentFullName,
          sourceCategory: candidate.bottle.category,
        },
      );

      return {
        blockingAlias:
          repairMode === "blocked_alias_conflict" && parentAlias
            ? {
                bottleFullName: parentAlias.bottleFullName,
                bottleId: parentAlias.bottleId,
                name: candidate.proposedParentFullName,
                releaseFullName: parentAlias.releaseFullName,
                releaseId: parentAlias.releaseId,
              }
            : null,
        blockingParent:
          repairMode === "blocked_dirty_parent" && blockingParent
            ? {
                id: blockingParent.id,
                fullName: blockingParent.fullName,
                totalTastings: blockingParent.totalTastings,
              }
            : null,
        legacyBottle: candidate.bottle,
        proposedParent: {
          id: parent?.id ?? null,
          fullName: parent?.fullName ?? candidate.proposedParentFullName,
          totalTastings: parent?.totalTastings ?? null,
        },
        releaseIdentity: {
          edition: candidate.edition,
          releaseYear: candidate.releaseYear,
          markerSources: candidate.markerSources,
        },
        siblingLegacyBottles: siblings,
        hasExactParent: parentMatch.matchType === "exact",
        repairMode,
      } satisfies LegacyReleaseRepairCandidate;
    })
    .sort((a, b) => {
      const repairModePriority =
        getLegacyReleaseRepairModePriority(a.repairMode) -
        getLegacyReleaseRepairModePriority(b.repairMode);
      if (repairModePriority !== 0) {
        return repairModePriority;
      }

      if (a.siblingLegacyBottles.length !== b.siblingLegacyBottles.length) {
        return b.siblingLegacyBottles.length - a.siblingLegacyBottles.length;
      }

      const aTastingCount = getTastingCount(a.legacyBottle.totalTastings);
      const bTastingCount = getTastingCount(b.legacyBottle.totalTastings);

      if (aTastingCount !== bTastingCount) {
        return bTastingCount - aTastingCount;
      }

      return b.legacyBottle.id - a.legacyBottle.id;
    });

  const offset = (cursor - 1) * limit;
  const results = filteredCandidates.slice(offset, offset + limit + 1);

  return {
    results: results.slice(0, limit),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}
