import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  reviewArticles,
  reviews,
} from "@peated/server/db/schema";
import {
  ReviewArticleObservationSchema,
  ReviewArticleReviewSchema,
} from "@peated/server/externalReviews/observation";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

const StoredSummarySchema = z
  .object({
    text: z.string().trim().min(1).max(1_000),
    contentHash: z.string().trim().min(1).max(128),
    model: z.string().trim().min(1).max(255),
    promptVersion: z.string().trim().min(1).max(255),
    generatedAt: z.date(),
  })
  .strict();

const StoredReviewSchema = ReviewArticleReviewSchema.safeExtend({
  bottleId: z.number().int().positive().nullable().default(null),
  summary: StoredSummarySchema.nullable().default(null),
});

export const ReviewArticleInputSchema =
  ReviewArticleObservationSchema.safeExtend({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    reviews: z.array(StoredReviewSchema).min(1),
  }).superRefine(({ contentHash, reviews: reviewList }, context) => {
    for (const [index, review] of reviewList.entries()) {
      if (review.summary && review.summary.contentHash !== contentHash) {
        context.addIssue({
          code: "custom",
          message: "Summary content hash must match its article.",
          path: ["reviews", index, "summary", "contentHash"],
        });
      }
    }
  });

/**
 * Stores external review metadata. The input excludes full review text, HTML,
 * tasting notes, conclusions, and images. Callers must discard those values
 * before they call this function.
 */
export async function storeReviewArticle(rawInput: unknown) {
  const input = ReviewArticleInputSchema.parse(rawInput);

  return await db.transaction(async (tx) => {
    const policy = await tx.query.externalReviewSourcePolicies.findFirst({
      columns: { publicationMode: true },
      where: eq(
        externalReviewSourcePolicies.externalSiteId,
        input.externalSiteId,
      ),
    });
    const publishesAutomatically = policy?.publicationMode === "automatic";

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

    await tx
      .update(reviews)
      .set({
        summary: null,
        summaryContentHash: null,
        summaryModel: null,
        summaryPromptVersion: null,
        summaryGeneratedAt: null,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(reviews.articleId, article.id),
          isNotNull(reviews.summary),
          ne(reviews.summaryContentHash, input.contentHash),
        ),
      );

    const reviewIds: number[] = [];
    for (const review of input.reviews) {
      const hasInvalidBottle =
        review.bottleId !== null && invalidBottleIds.has(review.bottleId);
      const bottleId =
        review.bottleId !== null && !hasInvalidBottle ? review.bottleId : null;
      const publish = publishesAutomatically && bottleId !== null;
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
          summary: review.summary?.text ?? null,
          summaryContentHash: review.summary?.contentHash ?? null,
          summaryModel: review.summary?.model ?? null,
          summaryPromptVersion: review.summary?.promptVersion ?? null,
          summaryGeneratedAt: review.summary?.generatedAt ?? null,
          hidden: !publish,
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
            ...(review.summary
              ? {
                  summary: review.summary.text,
                  summaryContentHash: review.summary.contentHash,
                  summaryModel: review.summary.model,
                  summaryPromptVersion: review.summary.promptVersion,
                  summaryGeneratedAt: review.summary.generatedAt,
                }
              : {}),
            ...(hasInvalidBottle
              ? {
                  hidden: sql`CASE
                    WHEN ${reviews.bottleId} IS NULL
                      OR ${reviews.bottleId} = ${review.bottleId}
                    THEN TRUE
                    ELSE ${reviews.hidden}
                  END`,
                }
              : publish
                ? {
                    hidden: sql`CASE
                      WHEN ${reviews.bottleId} IS NULL
                        OR ${reviews.bottleId} = ${bottleId}
                      THEN FALSE
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
