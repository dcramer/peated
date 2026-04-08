import { db } from "@peated/server/db";
import { bottles, type Bottle } from "@peated/server/db/schema";
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

type DerivedLegacyReleaseRepairCandidate = {
  bottle: LegacyReleaseRepairBottle;
  proposedParentFullName: string;
  edition: string | null;
  releaseYear: number | null;
  markerSources: string[];
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

function normalizeComparableBottleName(fullName: string): string {
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

function deriveLegacyReleaseRepairCandidate(
  bottle: LegacyReleaseRepairBottle,
): DerivedLegacyReleaseRepairCandidate | null {
  const normalizedFullName = normalizeBottleBatchNumber(
    normalizeString(bottle.fullName),
  );
  const comparableFullName = normalizeComparableBottleName(normalizedFullName);
  const parsedIdentity = normalizeBottle({ name: normalizedFullName });
  const edition = bottle.edition ?? extractBatchEdition(normalizedFullName);
  const releaseYear = bottle.releaseYear ?? parsedIdentity.releaseYear;
  const markerSources: string[] = [];

  if (bottle.edition) {
    markerSources.push("structured_edition");
  } else if (edition) {
    markerSources.push("name_batch");
  }

  if (bottle.releaseYear) {
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
    bottle,
    proposedParentFullName,
    edition,
    releaseYear,
    markerSources,
  };
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
    .orderBy(desc(bottles.totalTastings), desc(bottles.id))
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
          })
          .from(bottles)
          .where(
            sql`LOWER(${bottles.fullName}) IN (${sql.join(
              Array.from(parentNames).map((name) => sql`${name}`),
              sql`, `,
            )})`,
          )
      : [];

  const parentByName = new Map<
    string,
    { id: number; fullName: string; totalTastings: null | number }
  >();
  for (const row of parentRows) {
    const key = row.fullName.toLowerCase();
    const existing = parentByName.get(key);
    if (
      !existing ||
      getTastingCount(row.totalTastings) >
        getTastingCount(existing.totalTastings)
    ) {
      parentByName.set(key, row);
    }
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
      const parent = parentByName.get(parentKey) ?? null;

      if (!parent && siblings.length === 0) {
        return null;
      }

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
      } satisfies LegacyReleaseRepairCandidate;
    })
    .filter((candidate): candidate is LegacyReleaseRepairCandidate =>
      Boolean(candidate),
    )
    .sort((a, b) => {
      if (a.hasExactParent !== b.hasExactParent) {
        return a.hasExactParent ? -1 : 1;
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
