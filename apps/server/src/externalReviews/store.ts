import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { NativeScoreSchema } from "@peated/server/schemas";
import { sql } from "drizzle-orm";
import { z } from "zod";

const ArticleReviewSchema = z
  .object({
    sourceKey: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(500),
    reviewerName: z.string().trim().min(1).max(255).nullable().default(null),
    nativeScore: NativeScoreSchema.nullable().default(null),
    normalizedRating: z.number().int().min(0).max(100).nullable().default(null),
  })
  .strict();

export const ReviewArticleInputSchema = z
  .object({
    externalSiteId: z.number().int().positive(),
    canonicalUrl: z
      .url()
      .refine(
        (value) => ["http:", "https:"].includes(new URL(value).protocol),
        {
          message: "Canonical URL must use HTTP or HTTPS.",
        },
      ),
    title: z.string().trim().min(1).max(1000),
    issue: z.string().trim().min(1).max(255).nullable().default(null),
    publishedAt: z.date().nullable().default(null),
    contentHash: z.string().trim().min(1).max(128),
    fetchedAt: z.date(),
    reviews: z.array(ArticleReviewSchema).min(1),
  })
  .strict()
  .superRefine(({ reviews }, context) => {
    const sourceKeys = new Set<string>();
    for (const [index, review] of reviews.entries()) {
      if (sourceKeys.has(review.sourceKey)) {
        context.addIssue({
          code: "custom",
          message: "Review source keys must be unique within an article.",
          path: ["reviews", index, "sourceKey"],
        });
      }
      sourceKeys.add(review.sourceKey);
    }
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
          externalSiteId: input.externalSiteId,
          articleId: article.id,
          sourceKey: review.sourceKey,
          name: review.name,
          reviewerName: review.reviewerName,
          nativeScoreValue: review.nativeScore?.value ?? null,
          nativeScoreScale: review.nativeScore?.scale ?? null,
          nativeScoreDisplay: review.nativeScore?.display ?? null,
          rating: review.normalizedRating,
          // TODO(external-review-indexing): Remove these copies when OpenSpec
          // task 3.5 completes the review-article hard cutover.
          issue: input.issue ?? input.canonicalUrl,
          url: input.canonicalUrl,
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
            issue: input.issue ?? input.canonicalUrl,
            url: input.canonicalUrl,
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
