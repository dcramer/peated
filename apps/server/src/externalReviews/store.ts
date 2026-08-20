import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { ReviewArticleObservationSchema } from "@peated/server/externalReviews/observation";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const ReviewArticleInputSchema =
  ReviewArticleObservationSchema.safeExtend({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
  });

/**
 * Owns durable external-review metadata. The strict input deliberately excludes
 * publisher bodies, HTML, tasting notes, conclusions, and images; callers must
 * discard those transient values before crossing this boundary.
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

    const reviewIds: number[] = [];
    for (const review of input.reviews) {
      const [stored] = await tx
        .insert(reviews)
        .values({
          articleId: article.id,
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
            name: review.name,
            reviewerName: review.reviewerName,
            nativeScoreValue: review.nativeScore?.value ?? null,
            nativeScoreScale: review.nativeScore?.scale ?? null,
            nativeScoreDisplay: review.nativeScore?.display ?? null,
            rating: review.normalizedRating,
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
