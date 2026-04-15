import {
  deriveLegacyReleaseRepairIdentity,
  getLegacyReleaseRepairParentMode,
  type LegacyReleaseRepairParentCandidate,
} from "@peated/bottle-classifier/legacyReleaseRepairIdentity";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  legacyReleaseRepairReviews,
  type Bottle,
  type LegacyReleaseRepairReview,
} from "@peated/server/db/schema";
import { reviewLegacyCreateParentResolutionWithClassifier } from "@peated/server/lib/legacyReleaseRepairClassifier";
import {
  getLegacyReleaseRepairBottleFingerprint,
  getLegacyReleaseRepairParentCandidatesFingerprint,
  LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
} from "@peated/server/lib/legacyReleaseRepairReviewState";
import { and, desc, eq, sql } from "drizzle-orm";

type LegacyReleaseRepairReviewBottle = Pick<
  Bottle,
  | "abv"
  | "brandId"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "category"
  | "edition"
  | "fullName"
  | "id"
  | "numReleases"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "vintageYear"
  | "caskType"
>;

async function getLegacyBottleForReview(legacyBottleId: number) {
  const [legacyBottle] = await db
    .select({
      id: bottles.id,
      brandId: bottles.brandId,
      fullName: bottles.fullName,
      category: bottles.category,
      edition: bottles.edition,
      statedAge: bottles.statedAge,
      abv: bottles.abv,
      singleCask: bottles.singleCask,
      caskStrength: bottles.caskStrength,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
      numReleases: bottles.numReleases,
    })
    .from(bottles)
    .where(eq(bottles.id, legacyBottleId))
    .limit(1);

  return legacyBottle ?? null;
}

async function deleteLegacyReleaseRepairReview(legacyBottleId: number) {
  await db
    .delete(legacyReleaseRepairReviews)
    .where(eq(legacyReleaseRepairReviews.legacyBottleId, legacyBottleId));
}

async function getParentRowsForReview({
  legacyBottle,
  proposedParentFullName,
}: {
  legacyBottle: Pick<LegacyReleaseRepairReviewBottle, "brandId" | "id">;
  proposedParentFullName: string;
}) {
  return await db
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
      legacyBottle.brandId
        ? and(
            eq(bottles.brandId, legacyBottle.brandId),
            sql`${bottles.id} != ${legacyBottle.id}`,
          )
        : and(
            eq(
              sql`LOWER(${bottles.fullName})`,
              proposedParentFullName.toLowerCase(),
            ),
            sql`${bottles.id} != ${legacyBottle.id}`,
          ),
    )
    .orderBy(sql`${bottles.totalTastings} DESC NULLS LAST`, desc(bottles.id));
}

async function getParentAlias({
  proposedParentFullName,
}: {
  proposedParentFullName: string;
}) {
  const [parentAlias] = await db
    .select({
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
    })
    .from(bottleAliases)
    .where(
      eq(
        sql`LOWER(${bottleAliases.name})`,
        proposedParentFullName.toLowerCase(),
      ),
    )
    .limit(1);

  return parentAlias ?? null;
}

function normalizeReviewRow(
  row: LegacyReleaseRepairReview,
): LegacyReleaseRepairReview {
  return {
    ...row,
    blockedReason: row.blockedReason ?? null,
    legacyBottleFingerprint: row.legacyBottleFingerprint ?? null,
    parentCandidatesFingerprint: row.parentCandidatesFingerprint ?? null,
    releaseEdition: row.releaseEdition ?? null,
    releaseYear: row.releaseYear ?? null,
    reviewedParentBottleId: row.reviewedParentBottleId ?? null,
  };
}

export type LegacyReleaseRepairReviewBlockedReasonCategory =
  | "classifier_review_failed"
  | "classifier_exact_cask"
  | "classifier_outside_parent_set"
  | "classifier_dirty_parent_candidate"
  | "classifier_unresolved_parent_decision"
  | "other";

export function getLegacyReleaseRepairReviewBlockedReasonCategory(
  blockedReason: null | string,
): LegacyReleaseRepairReviewBlockedReasonCategory {
  if (!blockedReason) {
    return "other";
  }

  if (
    blockedReason.startsWith("Classifier could not review parent resolution:")
  ) {
    return "classifier_review_failed";
  }

  if (
    blockedReason ===
    "Classifier treated this bottle as exact-cask identity, so release repair cannot safely create a reusable parent bottle."
  ) {
    return "classifier_exact_cask";
  }

  if (
    blockedReason ===
    "Classifier pointed at a bottle outside the reviewed repair parent set."
  ) {
    return "classifier_outside_parent_set";
  }

  if (
    blockedReason ===
    "Classifier found a reusable parent candidate, but that bottle still has bottle-level release traits."
  ) {
    return "classifier_dirty_parent_candidate";
  }

  if (
    blockedReason ===
    "Classifier could not verify whether this repair should reuse an existing parent bottle or create a new one."
  ) {
    return "classifier_unresolved_parent_decision";
  }

  return "other";
}

export async function refreshLegacyReleaseRepairReview({
  legacyBottleId,
}: {
  legacyBottleId: number;
}): Promise<LegacyReleaseRepairReview | null> {
  const legacyBottle = await getLegacyBottleForReview(legacyBottleId);
  if (!legacyBottle || (legacyBottle.numReleases ?? 0) > 0) {
    await deleteLegacyReleaseRepairReview(legacyBottleId);
    return null;
  }

  const repairIdentity = deriveLegacyReleaseRepairIdentity({
    fullName: legacyBottle.fullName,
    edition: legacyBottle.edition,
    releaseYear: legacyBottle.releaseYear,
  });
  if (!repairIdentity) {
    await deleteLegacyReleaseRepairReview(legacyBottleId);
    return null;
  }

  const [parentRows, parentAlias] = await Promise.all([
    getParentRowsForReview({
      legacyBottle,
      proposedParentFullName: repairIdentity.proposedParentFullName,
    }),
    getParentAlias({
      proposedParentFullName: repairIdentity.proposedParentFullName,
    }),
  ]);

  const heuristicRepairMode = getLegacyReleaseRepairParentMode(parentRows, {
    currentLegacyBottleId: legacyBottle.id,
    parentAlias,
    proposedParentFullName: repairIdentity.proposedParentFullName,
    release: {
      edition: repairIdentity.edition,
      statedAge: legacyBottle.statedAge,
      abv: legacyBottle.abv,
      releaseYear: repairIdentity.releaseYear,
      vintageYear: legacyBottle.vintageYear,
      singleCask: legacyBottle.singleCask,
      caskStrength: legacyBottle.caskStrength,
      caskFill: legacyBottle.caskFill,
      caskType: legacyBottle.caskType,
      caskSize: legacyBottle.caskSize,
    },
  });

  if (heuristicRepairMode !== "create_parent") {
    await deleteLegacyReleaseRepairReview(legacyBottleId);
    return null;
  }

  const classifierResolution =
    await reviewLegacyCreateParentResolutionWithClassifier({
      legacyBottle,
      parentRows: parentRows as LegacyReleaseRepairParentCandidate[],
    });
  const legacyBottleFingerprint =
    getLegacyReleaseRepairBottleFingerprint(legacyBottle);
  const parentCandidatesFingerprint =
    getLegacyReleaseRepairParentCandidatesFingerprint(parentRows);

  const [review] = await db
    .insert(legacyReleaseRepairReviews)
    .values({
      legacyBottleId,
      legacyBottleFingerprint,
      parentCandidatesFingerprint,
      proposedParentFullName: repairIdentity.proposedParentFullName,
      releaseEdition: repairIdentity.edition,
      releaseYear: repairIdentity.releaseYear,
      resolution: classifierResolution.resolution,
      reviewedParentBottleId:
        classifierResolution.resolution === "reuse_existing_parent"
          ? classifierResolution.parentBottle.id
          : null,
      blockedReason:
        classifierResolution.resolution === "blocked"
          ? classifierResolution.message
          : null,
      reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: legacyReleaseRepairReviews.legacyBottleId,
      set: {
        legacyBottleFingerprint,
        parentCandidatesFingerprint,
        proposedParentFullName: repairIdentity.proposedParentFullName,
        releaseEdition: repairIdentity.edition,
        releaseYear: repairIdentity.releaseYear,
        resolution: classifierResolution.resolution,
        reviewedParentBottleId:
          classifierResolution.resolution === "reuse_existing_parent"
            ? classifierResolution.parentBottle.id
            : null,
        blockedReason:
          classifierResolution.resolution === "blocked"
            ? classifierResolution.message
            : null,
        reviewVersion: LEGACY_RELEASE_REPAIR_REVIEW_VERSION,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return review ? normalizeReviewRow(review) : null;
}
