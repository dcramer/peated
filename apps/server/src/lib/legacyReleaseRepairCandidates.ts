import { db } from "@peated/server/db";
import { bottleAliases, bottles, type Bottle } from "@peated/server/db/schema";
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

type LegacyReleaseRepairBottle = Omit<
  Pick<
    Bottle,
    | "id"
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

export type DerivedLegacyReleaseRepairCandidate =
  LegacyReleaseRepairIdentity & {
    bottle: LegacyReleaseRepairBottle;
  };

export type LegacyReleaseRepairCandidate = {
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

export function getLegacyReleaseRepairParentMode<
  TRow extends LegacyReleaseRepairParentCandidate,
>(
  rows: TRow[],
  {
    currentLegacyBottleId,
    parentAlias,
  }: {
    currentLegacyBottleId?: number;
    parentAlias?: {
      bottleId: number | null;
      releaseId: number | null;
    } | null;
  } = {},
): LegacyReleaseRepairParentMode {
  if (pickBestLegacyReleaseRepairParent(rows)) {
    return "existing_parent";
  }

  if (rows.some((row) => hasBottleLevelReleaseTraits(row))) {
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
  const parentNames = new Set<string>();
  for (const candidate of derivedCandidates) {
    const parentKey = candidate.proposedParentFullName.toLowerCase();
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

  const parentByName = new Map<
    string,
    { id: number; fullName: string; totalTastings: null | number }
  >();
  const parentRowsByName = new Map<string, typeof parentRows>();
  const parentAliasByName = new Map<
    string,
    { bottleId: number | null; releaseId: number | null }
  >();
  for (const row of parentRows) {
    const key = row.fullName.toLowerCase();
    const group = parentRowsByName.get(key) ?? [];
    group.push(row);
    parentRowsByName.set(key, group);
  }
  for (const [key, rows] of parentRowsByName) {
    const parent = pickBestLegacyReleaseRepairParent(rows);
    if (parent) {
      parentByName.set(key, parent);
    }
  }
  for (const row of parentAliasRows) {
    parentAliasByName.set(row.name.toLowerCase(), {
      bottleId: row.bottleId,
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
      const parentAlias = parentAliasByName.get(parentKey) ?? null;
      const parent = parentByName.get(parentKey) ?? null;
      const repairMode = getLegacyReleaseRepairParentMode(parentRowsForName, {
        currentLegacyBottleId: candidate.bottle.id,
        parentAlias,
      });

      return {
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
        hasExactParent: Boolean(parent),
        repairMode,
      } satisfies LegacyReleaseRepairCandidate;
    })
    .filter((candidate): candidate is LegacyReleaseRepairCandidate =>
      Boolean(candidate),
    )
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
