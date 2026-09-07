import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

const WHISKY_ADVOCATE_SITE = "whiskyadvocate";
const WHISKY_ADVOCATE_SCORE_SCALE = 100;

export interface WhiskyAdvocateScoreRepairResult {
  siteId: number;
  totalReviews: number;
  updatedReviews: number;
  unchangedReviews: number;
  preservedNativeScores: number;
  skippedLegacyScores: number;
  affectedBottleIds: number[];
}

export class WhiskyAdvocateSiteNotFoundError extends Error {
  constructor() {
    super("Whisky Advocate site not found.");
    this.name = "WhiskyAdvocateSiteNotFoundError";
  }
}

function isValidLegacyScore(score: number | null): score is number {
  return (
    score !== null &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= WHISKY_ADVOCATE_SCORE_SCALE
  );
}

/** Restores raw publisher scores retained by Peated's legacy Whisky Advocate import. */
export async function repairWhiskyAdvocateScores(): Promise<WhiskyAdvocateScoreRepairResult> {
  return await db.transaction(async (tx) => {
    const [site] = await tx
      .select({ id: externalSites.id })
      .from(externalSites)
      .where(eq(externalSites.type, WHISKY_ADVOCATE_SITE))
      .limit(1)
      .for("update");
    if (!site) throw new WhiskyAdvocateSiteNotFoundError();

    const reviews = await tx
      .select({
        id: externalReviews.id,
        bottleId: externalReviews.bottleId,
        legacyScore: externalReviews.legacyNormalizedScore,
        nativeScoreValue: externalReviews.nativeScoreValue,
        nativeScoreScale: externalReviews.nativeScoreScale,
        nativeScoreDisplay: externalReviews.nativeScoreDisplay,
      })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviewArticles.id, externalReviews.articleId),
      )
      .where(eq(externalReviewArticles.externalSiteId, site.id))
      .for("update", { of: externalReviews });

    const repairable = reviews.filter(
      (review) =>
        isValidLegacyScore(review.legacyScore) &&
        review.nativeScoreValue === null &&
        review.nativeScoreScale === null &&
        review.nativeScoreDisplay === null,
    );

    if (repairable.length) {
      await tx
        .update(externalReviews)
        .set({
          nativeScoreValue: sql`${externalReviews.legacyNormalizedScore}`,
          nativeScoreScale: WHISKY_ADVOCATE_SCORE_SCALE,
          nativeScoreDisplay: sql`CAST(${externalReviews.legacyNormalizedScore} AS text) || '/100'`,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            externalReviews.id,
            repairable.map((review) => review.id),
          ),
        );
    }

    const repairedIds = new Set(repairable.map((review) => review.id));
    const affectedBottleIds = [
      ...new Set(
        reviews.flatMap((review) => {
          if (!isValidLegacyScore(review.legacyScore)) return [];
          const hasRestoredScore =
            repairedIds.has(review.id) ||
            (review.nativeScoreValue === review.legacyScore &&
              review.nativeScoreScale === WHISKY_ADVOCATE_SCORE_SCALE &&
              review.nativeScoreDisplay === `${review.legacyScore}/100`);
          return hasRestoredScore && review.bottleId !== null
            ? [review.bottleId]
            : [];
        }),
      ),
    ].sort((left, right) => left - right);
    const preservedNativeScores = reviews.filter(
      (review) => review.nativeScoreValue !== null,
    ).length;
    const skippedLegacyScores = reviews.filter(
      (review) =>
        review.nativeScoreValue === null &&
        !isValidLegacyScore(review.legacyScore),
    ).length;

    return {
      siteId: site.id,
      totalReviews: reviews.length,
      updatedReviews: repairable.length,
      unchangedReviews: reviews.length - repairable.length,
      preservedNativeScores,
      skippedLegacyScores,
      affectedBottleIds,
    };
  });
}
