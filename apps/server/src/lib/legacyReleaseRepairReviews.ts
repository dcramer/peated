import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  legacyReleaseRepairReviews,
  type Bottle,
  type LegacyReleaseRepairReview,
} from "@peated/server/db/schema";
import {
  deriveLegacyReleaseRepairIdentity,
  getLegacyReleaseRepairParentMode,
  type LegacyReleaseRepairParentCandidate,
} from "@peated/server/lib/legacyReleaseRepairCandidates";
import { reviewLegacyCreateParentResolutionWithClassifier } from "@peated/server/lib/legacyReleaseRepairClassifier";
import { LEGACY_RELEASE_REPAIR_REVIEW_VERSION } from "@peated/server/lib/legacyReleaseRepairReviewState";
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
    releaseEdition: row.releaseEdition ?? null,
    releaseYear: row.releaseYear ?? null,
    reviewedParentBottleId: row.reviewedParentBottleId ?? null,
  };
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

  const [review] = await db
    .insert(legacyReleaseRepairReviews)
    .values({
      legacyBottleId,
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
