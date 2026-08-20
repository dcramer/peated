import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import {
  ReviewArticleObservationSchema,
  ReviewArticleReviewSchema,
} from "@peated/server/externalReviews/observation";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { sql } from "drizzle-orm";
import { z } from "zod";

const StoredReviewSchema = ReviewArticleReviewSchema.safeExtend({
  bottleId: z.number().int().positive().nullable().default(null),
});

export const ReviewArticleInputSchema =
  ReviewArticleObservationSchema.safeExtend({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    reviews: z.array(StoredReviewSchema).min(1),
  });

/**
 * Stores external review metadata. The input excludes full review text, HTML,
 * tasting notes, conclusions, and images. Callers must discard those values
 * before they call this function.
 */
export async function storeReviewArticle(rawInput: unknown) {
  const input = ReviewArticleInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    const [article] = await tx
      .insert(reviewArticles)
      .values({
        externalSiteId: input.externalSiteId,
        canonicalUrl: input.canonicalUrl,
        title: input.title,
        issue: input.issue,
        publishedAt: input.publishedAt,
        contentHash: input.contentHash,
        fetchedAt: input.fetchedAt,
      })
      .onConflictDoUpdate({
        target: [reviewArticles.externalSiteId, reviewArticles.canonicalUrl],
        set: {
          title: input.title,
          issue: input.issue,
          publishedAt: input.publishedAt,
          contentHash: input.contentHash,
          fetchedAt: input.fetchedAt,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({ id: reviewArticles.id });

    if (!article) throw new Error("Unable to store review article.");

    // Match createExternalReview lock order: article, Bottles, then reviews.
    const invalidBottleIds = new Set<number>();
    const bottleIds = [
      ...new Set(
        input.reviews.flatMap(({ bottleId }) =>
          bottleId === null ? [] : [bottleId],
        ),
      ),
    ].sort((left, right) => left - right);
    for (const bottleId of bottleIds) {
      try {
        await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });
      } catch (error) {
        if (!(error instanceof ActiveBottleSelectionError)) throw error;
        invalidBottleIds.add(bottleId);
      }
    }

    const reviewIds: number[] = [];
    for (const review of input.reviews) {
      const hasInvalidBottle =
        review.bottleId !== null && invalidBottleIds.has(review.bottleId);
      const bottleId =
        review.bottleId !== null && !hasInvalidBottle ? review.bottleId : null;
      const [stored] = await tx
        .insert(reviews)
        .values({
          articleId: article.id,
          bottleId,
          sourceKey: review.sourceKey,
          name: review.name,
          reviewerName: review.reviewerName,
          nativeScoreValue: review.nativeScore?.value ?? null,
          nativeScoreScale: review.nativeScore?.scale ?? null,
          nativeScoreDisplay: review.nativeScore?.display ?? null,
          rating: review.normalizedRating,
          hidden: true,
        })
        .onConflictDoUpdate({
          target: [reviews.articleId, reviews.sourceKey],
          set: {
            bottleId: sql`CASE
              WHEN excluded.bottle_id IS NOT NULL
                AND (${reviews.bottleId} IS NULL OR ${reviews.bottleId} = excluded.bottle_id)
              THEN excluded.bottle_id
              ELSE ${reviews.bottleId}
            END`,
            name: review.name,
            reviewerName: review.reviewerName,
            nativeScoreValue: review.nativeScore?.value ?? null,
            nativeScoreScale: review.nativeScore?.scale ?? null,
            nativeScoreDisplay: review.nativeScore?.display ?? null,
            rating: review.normalizedRating,
            ...(hasInvalidBottle
              ? {
                  hidden: sql`CASE
                    WHEN ${reviews.bottleId} IS NULL
                      OR ${reviews.bottleId} = ${review.bottleId}
                    THEN TRUE
                    ELSE ${reviews.hidden}
                  END`,
                }
              : {}),
            updatedAt: sql`NOW()`,
          },
        })
        .returning({ id: reviews.id });

      if (!stored) throw new Error("Unable to store review.");
      reviewIds.push(stored.id);
    }

    return { articleId: article.id, reviewIds };
  });
}
