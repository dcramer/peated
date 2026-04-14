import {
  bottleMarketsStatedAge,
  formatCanonicalReleaseName,
  hasBottleLevelReleaseTraits,
  hasDirtyBottleLevelStatedAgeConflict,
} from "@peated/bottle-classifier/bottleSchemaRules";
import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  type Bottle,
  type BottleRelease,
} from "@peated/server/db/schema";
import { desc, gt, isNotNull, sql } from "drizzle-orm";

const MAX_CANDIDATE_LIMIT = 2000;
const SCAN_BATCH_LIMIT = 2000;

type DirtyParentAgeRepairBottle = Pick<
  Bottle,
  | "abv"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "edition"
  | "fullName"
  | "id"
  | "name"
  | "numReleases"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "totalTastings"
  | "vintageYear"
> & {
  statedAge: number;
};

export type DirtyParentAgeRepairRelease = Pick<
  BottleRelease,
  | "abv"
  | "bottleId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "edition"
  | "fullName"
  | "id"
  | "name"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "totalTastings"
  | "vintageYear"
>;

export type DirtyParentAgeRepairCandidate = {
  bottle: DirtyParentAgeRepairBottle;
  conflictingReleases: Array<{
    fullName: string;
    id: number;
    statedAge: number;
    totalTastings: number | null;
  }>;
  repairMode: "create_release" | "existing_release";
  targetRelease: {
    fullName: string;
    id: number | null;
    statedAge: number;
    totalTastings: number | null;
  };
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

function isFormerDirtyParentAgeRelease(
  release: Pick<
    DirtyParentAgeRepairRelease,
    | "abv"
    | "caskFill"
    | "caskSize"
    | "caskStrength"
    | "caskType"
    | "edition"
    | "releaseYear"
    | "singleCask"
    | "statedAge"
    | "vintageYear"
  >,
  bottleStatedAge: number,
) {
  return (
    release.statedAge === bottleStatedAge &&
    release.edition === null &&
    release.releaseYear === null &&
    release.vintageYear === null &&
    release.abv === null &&
    release.singleCask === null &&
    release.caskStrength === null &&
    release.caskFill === null &&
    release.caskType === null &&
    release.caskSize === null
  );
}

export function pickExistingDirtyParentAgeRepairTargetRelease<
  TRelease extends DirtyParentAgeRepairRelease,
>(releases: TRelease[], bottleStatedAge: number): null | TRelease {
  let bestRelease: null | TRelease = null;

  for (const release of releases) {
    if (!isFormerDirtyParentAgeRelease(release, bottleStatedAge)) {
      continue;
    }

    if (
      !bestRelease ||
      getTastingCount(release.totalTastings) >
        getTastingCount(bestRelease.totalTastings)
    ) {
      bestRelease = release;
    }
  }

  return bestRelease;
}

export function deriveDirtyParentAgeRepairCandidate({
  bottle,
  releases,
}: {
  bottle: Omit<DirtyParentAgeRepairBottle, "statedAge"> & {
    statedAge: null | number;
  };
  releases: DirtyParentAgeRepairRelease[];
}): DirtyParentAgeRepairCandidate | null {
  if (
    bottle.statedAge === null ||
    bottle.statedAge === undefined ||
    bottle.numReleases <= 0 ||
    bottleMarketsStatedAge(bottle) ||
    hasBottleLevelReleaseTraits(bottle)
  ) {
    return null;
  }

  const conflictingReleases = releases
    .filter(
      (
        release,
      ): release is DirtyParentAgeRepairRelease & { statedAge: number } =>
        release.statedAge !== null &&
        hasDirtyBottleLevelStatedAgeConflict({
          bottle,
          releaseStatedAge: release.statedAge,
        }),
    )
    .sort((left, right) => {
      const tastingDiff =
        getTastingCount(right.totalTastings) -
        getTastingCount(left.totalTastings);
      if (tastingDiff !== 0) {
        return tastingDiff;
      }
      return right.id - left.id;
    });

  if (conflictingReleases.length === 0) {
    return null;
  }

  const existingTargetRelease = pickExistingDirtyParentAgeRepairTargetRelease(
    releases,
    bottle.statedAge,
  );
  const targetReleaseNames = formatCanonicalReleaseName({
    bottleName: bottle.name,
    bottleFullName: bottle.fullName,
    bottleStatedAge: null,
    release: {
      edition: null,
      statedAge: bottle.statedAge,
      abv: null,
      releaseYear: null,
      vintageYear: null,
      singleCask: null,
      caskStrength: null,
      caskFill: null,
      caskType: null,
      caskSize: null,
    },
  });

  return {
    bottle: {
      ...bottle,
      statedAge: bottle.statedAge,
    },
    conflictingReleases: conflictingReleases.map((release) => ({
      id: release.id,
      fullName: release.fullName,
      statedAge: release.statedAge,
      totalTastings: release.totalTastings,
    })),
    repairMode: existingTargetRelease ? "existing_release" : "create_release",
    targetRelease: {
      id: existingTargetRelease?.id ?? null,
      fullName: existingTargetRelease?.fullName ?? targetReleaseNames.fullName,
      statedAge: bottle.statedAge,
      totalTastings: existingTargetRelease?.totalTastings ?? null,
    },
  };
}

export async function getDirtyParentAgeRepairCandidates({
  query = "",
  cursor = 1,
  limit = 25,
}: {
  cursor?: number;
  limit?: number;
  query?: string;
}) {
  const candidates: DirtyParentAgeRepairCandidate[] = [];
  let scanOffset = 0;

  while (candidates.length < MAX_CANDIDATE_LIMIT) {
    const suspiciousBottles = await db
      .select({
        id: bottles.id,
        fullName: bottles.fullName,
        name: bottles.name,
        statedAge: bottles.statedAge,
        numReleases: bottles.numReleases,
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
        sql.join(
          [
            isNotNull(bottles.statedAge),
            gt(bottles.numReleases, 0),
            query
              ? sql`${bottles.fullName} ILIKE ${`%${escapeLikePattern(query)}%`} ESCAPE '\\'`
              : undefined,
          ].filter((value): value is NonNullable<typeof value> =>
            Boolean(value),
          ),
          sql` AND `,
        ),
      )
      .orderBy(sql`${bottles.totalTastings} DESC NULLS LAST`, desc(bottles.id))
      .offset(scanOffset)
      .limit(SCAN_BATCH_LIMIT);

    if (suspiciousBottles.length === 0) {
      break;
    }

    const bottleIds = suspiciousBottles.map((bottle) => bottle.id);
    const releaseRows = await db
      .select({
        id: bottleReleases.id,
        bottleId: bottleReleases.bottleId,
        fullName: bottleReleases.fullName,
        name: bottleReleases.name,
        statedAge: bottleReleases.statedAge,
        edition: bottleReleases.edition,
        releaseYear: bottleReleases.releaseYear,
        vintageYear: bottleReleases.vintageYear,
        abv: bottleReleases.abv,
        singleCask: bottleReleases.singleCask,
        caskStrength: bottleReleases.caskStrength,
        caskFill: bottleReleases.caskFill,
        caskType: bottleReleases.caskType,
        caskSize: bottleReleases.caskSize,
        totalTastings: bottleReleases.totalTastings,
      })
      .from(bottleReleases)
      .where(
        sql`${bottleReleases.bottleId} IN (${sql.join(
          bottleIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const releasesByBottleId = new Map<number, DirtyParentAgeRepairRelease[]>();
    for (const release of releaseRows) {
      const group = releasesByBottleId.get(release.bottleId) ?? [];
      group.push(release);
      releasesByBottleId.set(release.bottleId, group);
    }

    candidates.push(
      ...suspiciousBottles
        .map((bottle) =>
          deriveDirtyParentAgeRepairCandidate({
            bottle,
            releases: releasesByBottleId.get(bottle.id) ?? [],
          }),
        )
        .filter((candidate): candidate is DirtyParentAgeRepairCandidate =>
          Boolean(candidate),
        ),
    );

    if (suspiciousBottles.length < SCAN_BATCH_LIMIT) {
      break;
    }

    scanOffset += suspiciousBottles.length;
  }

  if (candidates.length === 0) {
    return {
      results: [],
      rel: {
        nextCursor: null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  }
  const cappedCandidates = candidates
    .sort((left, right) => {
      if (left.repairMode !== right.repairMode) {
        return left.repairMode === "existing_release" ? -1 : 1;
      }

      if (
        left.conflictingReleases.length !== right.conflictingReleases.length
      ) {
        return (
          right.conflictingReleases.length - left.conflictingReleases.length
        );
      }

      const tastingDiff =
        getTastingCount(right.bottle.totalTastings) -
        getTastingCount(left.bottle.totalTastings);
      if (tastingDiff !== 0) {
        return tastingDiff;
      }

      return right.bottle.id - left.bottle.id;
    })
    .slice(0, MAX_CANDIDATE_LIMIT);

  const offset = (cursor - 1) * limit;
  const results = cappedCandidates.slice(offset, offset + limit + 1);

  return {
    results: results.slice(0, limit),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}
