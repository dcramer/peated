import {
  deriveLegacyReleaseRepairIdentity,
  getLegacyReleaseRepairBlockingParent,
  getLegacyReleaseRepairParentMode,
  hasVariantLegacyReleaseRepairParentName,
  LEGACY_RELEASE_MARKER_PATTERN,
  normalizeComparableBottleName,
  resolveLegacyReleaseRepairNameScope,
  resolveLegacyReleaseRepairParentMatch,
  type LegacyReleaseRepairIdentity,
  type LegacyReleaseRepairParentCandidate,
} from "@peated/bottle-classifier/legacyReleaseRepairIdentity";
import { hasBottleLevelReleaseTraits } from "@peated/bottle-classifier/releaseIdentity";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  legacyReleaseRepairReviews,
  type Bottle,
} from "@peated/server/db/schema";
import {
  getLegacyReleaseRepairBottleFingerprint,
  getLegacyReleaseRepairParentCandidatesFingerprint,
  isMatchingLegacyReleaseRepairReview,
  isMatchingLegacyReleaseRepairReviewIdentity,
  LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
} from "@peated/server/lib/legacyReleaseRepairReviewState";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";

const MAX_SCAN_LIMIT = 2000;

type LegacyReleaseRepairBottle = Omit<
  Pick<
    Bottle,
    | "id"
    | "abv"
    | "brandId"
    | "caskFill"
    | "caskSize"
    | "caskStrength"
    | "caskType"
    | "category"
    | "fullName"
    | "edition"
    | "singleCask"
    | "statedAge"
    | "vintageYear"
    | "releaseYear"
    | "numReleases"
    | "totalTastings"
  >,
  "totalTastings"
> & {
  totalTastings: null | number;
};

export type LegacyReleaseRepairParentMode =
  | "existing_parent"
  | "create_parent"
  | "blocked_classifier"
  | "blocked_alias_conflict"
  | "blocked_dirty_parent";

export type LegacyReleaseRepairParentResolutionSource =
  | "classifier_review_live"
  | "classifier_review_persisted"
  | "heuristic_exact"
  | "heuristic_variant";

export type LegacyReleaseRepairReviewState =
  | "fresh_allow_create_parent"
  | "fresh_blocked"
  | "fresh_reuse_existing_parent"
  | "stale_review"
  | "unreviewed";

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
  classifierBlocker: string | null;
  legacyBottleFingerprint?: null | string;
  legacyBottle: LegacyReleaseRepairBottle;
  parentCandidatesFingerprint?: null | string;
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
  parentResolutionSource: LegacyReleaseRepairParentResolutionSource | null;
  repairMode: LegacyReleaseRepairParentMode;
  reviewState?: LegacyReleaseRepairReviewState | null;
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

function getLegacyReleaseRepairModePriority(
  value: LegacyReleaseRepairParentMode,
): number {
  switch (value) {
    case "existing_parent":
      return 0;
    case "create_parent":
      return 1;
    case "blocked_classifier":
      return 2;
    case "blocked_alias_conflict":
      return 3;
    case "blocked_dirty_parent":
      return 4;
  }
}

function sortLegacyReleaseRepairCandidates(
  candidates: LegacyReleaseRepairCandidate[],
) {
  return [...candidates].sort((a, b) => {
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
}

function reviewMatchesLegacyReleaseRepairCandidate(
  candidate: LegacyReleaseRepairCandidate,
  review: {
    proposedParentFullName: string;
    releaseEdition: string | null;
    releaseYear: number | null;
  },
) {
  return isMatchingLegacyReleaseRepairReviewIdentity(
    {
      proposedParentFullName: candidate.proposedParent.fullName,
      releaseIdentity: candidate.releaseIdentity,
    },
    review,
  );
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

function applyStoredLegacyReleaseRepairReview({
  candidate,
  review,
  reviewedParentById,
}: {
  candidate: LegacyReleaseRepairCandidate;
  review:
    | {
        blockedReason: string | null;
        legacyBottleFingerprint: null | string;
        parentCandidatesFingerprint: null | string;
        proposedParentFullName: string;
        releaseEdition: string | null;
        releaseYear: number | null;
        resolution: "allow_create_parent" | "blocked" | "reuse_existing_parent";
        reviewedParentBottleId: number | null;
      }
    | undefined;
  reviewedParentById: Map<number, LegacyReleaseRepairParentCandidate>;
}): LegacyReleaseRepairCandidate {
  if (candidate.repairMode !== "create_parent") {
    return candidate;
  }

  if (!review) {
    return {
      ...candidate,
      reviewState: "unreviewed",
    } satisfies LegacyReleaseRepairCandidate;
  }

  if (
    candidate.legacyBottleFingerprint == null ||
    candidate.parentCandidatesFingerprint == null ||
    !isMatchingLegacyReleaseRepairReview(
      {
        legacyBottleFingerprint: candidate.legacyBottleFingerprint,
        parentCandidatesFingerprint: candidate.parentCandidatesFingerprint,
        proposedParentFullName: candidate.proposedParent.fullName,
        releaseIdentity: candidate.releaseIdentity,
      },
      review,
    )
  ) {
    return {
      ...candidate,
      reviewState: "stale_review",
    } satisfies LegacyReleaseRepairCandidate;
  }

  if (review.resolution === "reuse_existing_parent") {
    const reviewedParent =
      review.reviewedParentBottleId !== null
        ? (reviewedParentById.get(review.reviewedParentBottleId) ?? null)
        : null;
    if (!reviewedParent) {
      return {
        ...candidate,
        classifierBlocker:
          "Stored classifier review points at a missing parent bottle. Refresh the review before applying this repair.",
        repairMode: "blocked_classifier",
        reviewState: "fresh_blocked",
      } satisfies LegacyReleaseRepairCandidate;
    }

    if (hasBottleLevelReleaseTraits(reviewedParent)) {
      return {
        ...candidate,
        classifierBlocker:
          "Stored classifier-reviewed parent bottle still carries bottle-level release traits. Refresh the review after cleaning that parent.",
        repairMode: "blocked_classifier",
        reviewState: "fresh_blocked",
      } satisfies LegacyReleaseRepairCandidate;
    }

    return {
      ...candidate,
      classifierBlocker: null,
      hasExactParent: false,
      parentResolutionSource: "classifier_review_persisted",
      proposedParent: {
        id: reviewedParent.id,
        fullName: reviewedParent.fullName,
        totalTastings: reviewedParent.totalTastings,
      },
      repairMode: "existing_parent",
      reviewState: "fresh_reuse_existing_parent",
    } satisfies LegacyReleaseRepairCandidate;
  }

  if (review.resolution === "blocked") {
    return {
      ...candidate,
      classifierBlocker:
        review.blockedReason ??
        "Stored classifier review blocked this repair. Refresh the review for more detail.",
      repairMode: "blocked_classifier",
      reviewState: "fresh_blocked",
    } satisfies LegacyReleaseRepairCandidate;
  }

  return {
    ...candidate,
    reviewState: "fresh_allow_create_parent",
  } satisfies LegacyReleaseRepairCandidate;
}

async function listHeuristicLegacyReleaseRepairCandidates(query = "") {
  const suspiciousBottles = await db
    .select({
      id: bottles.id,
      abv: bottles.abv,
      brandId: bottles.brandId,
      caskFill: bottles.caskFill,
      caskSize: bottles.caskSize,
      caskStrength: bottles.caskStrength,
      caskType: bottles.caskType,
      category: bottles.category,
      fullName: bottles.fullName,
      edition: bottles.edition,
      singleCask: bottles.singleCask,
      statedAge: bottles.statedAge,
      vintageYear: bottles.vintageYear,
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
    return [];
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
            statedAge: bottles.statedAge,
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
            statedAge: bottles.statedAge,
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

  return sortLegacyReleaseRepairCandidates(
    derivedCandidates.map((candidate) => {
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
        },
      );
      const parent = parentMatch.parent;
      const blockingParent = getLegacyReleaseRepairBlockingParent(
        parentRowsForCandidate,
        {
          currentLegacyBottleId: candidate.bottle.id,
          proposedParentFullName: candidate.proposedParentFullName,
        },
      );
      const repairMode = getLegacyReleaseRepairParentMode(
        parentRowsForCandidate,
        {
          currentLegacyBottleId: candidate.bottle.id,
          parentAlias,
          proposedParentFullName: candidate.proposedParentFullName,
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
        classifierBlocker: null,
        legacyBottleFingerprint: getLegacyReleaseRepairBottleFingerprint(
          candidate.bottle,
        ),
        legacyBottle: candidate.bottle,
        parentCandidatesFingerprint:
          getLegacyReleaseRepairParentCandidatesFingerprint(
            parentRowsForCandidate.filter(
              (row) => row.id !== candidate.bottle.id,
            ),
          ),
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
        parentResolutionSource:
          repairMode === "existing_parent"
            ? parentMatch.matchType === "exact"
              ? "heuristic_exact"
              : "heuristic_variant"
            : null,
        repairMode,
        reviewState: null,
      } satisfies LegacyReleaseRepairCandidate;
    }),
  );
}

export async function getHeuristicLegacyReleaseRepairCandidates({
  query = "",
  cursor = 1,
  limit = 25,
}: {
  query?: string;
  cursor?: number;
  limit?: number;
}) {
  const filteredCandidates =
    await listHeuristicLegacyReleaseRepairCandidates(query);

  const offset = (cursor - 1) * limit;
  const results = filteredCandidates.slice(offset, offset + limit + 1);

  return {
    results: results.slice(0, limit).map((candidate) => ({
      ...candidate,
      reviewState: candidate.reviewState ?? null,
    })),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export async function getLegacyReleaseRepairCandidates(args: {
  query?: string;
  cursor?: number;
  limit?: number;
}) {
  const { query = "", cursor = 1, limit = 25 } = args;
  const heuristicCandidates =
    await listHeuristicLegacyReleaseRepairCandidates(query);
  const createParentCandidates = heuristicCandidates.filter(
    (candidate) => candidate.repairMode === "create_parent",
  );

  if (createParentCandidates.length === 0) {
    const offset = (cursor - 1) * limit;
    const results = heuristicCandidates.slice(offset, offset + limit + 1);

    return {
      results: results.slice(0, limit),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  }

  const reviewRows = await db
    .select()
    .from(legacyReleaseRepairReviews)
    .where(
      and(
        sql`${legacyReleaseRepairReviews.legacyBottleId} IN (${sql.join(
          createParentCandidates.map(
            (candidate) => sql`${candidate.legacyBottle.id}`,
          ),
          sql`, `,
        )})`,
        eq(
          legacyReleaseRepairReviews.reviewVersion,
          LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
        ),
      ),
    );

  const reviewByBottleId = new Map(
    reviewRows.map((review) => [review.legacyBottleId, review]),
  );
  const reviewedParentIds = Array.from(
    new Set(
      reviewRows
        .map((review) => review.reviewedParentBottleId)
        .filter((value): value is number => value !== null),
    ),
  );
  const reviewedParents =
    reviewedParentIds.length > 0
      ? await db
          .select({
            id: bottles.id,
            fullName: bottles.fullName,
            category: bottles.category,
            totalTastings: bottles.totalTastings,
            edition: bottles.edition,
            statedAge: bottles.statedAge,
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
            sql`${bottles.id} IN (${sql.join(
              reviewedParentIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];
  const reviewedParentById = new Map(
    reviewedParents.map((parent) => [parent.id, parent]),
  );

  const reviewedCandidates = sortLegacyReleaseRepairCandidates(
    heuristicCandidates.map((candidate) =>
      applyStoredLegacyReleaseRepairReview({
        candidate,
        review: reviewByBottleId.get(candidate.legacyBottle.id),
        reviewedParentById,
      }),
    ),
  );

  const offset = (cursor - 1) * limit;
  const pageResults = reviewedCandidates.slice(offset, offset + limit + 1);

  return {
    results: pageResults.slice(0, limit).map((candidate) => ({
      ...candidate,
      reviewState: candidate.reviewState ?? null,
    })),
    rel: {
      nextCursor: pageResults.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}
