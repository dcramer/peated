import { NativeScoreSchema } from "@peated/server/schemas";
import { z } from "zod";

export const ReviewArticleReviewSchema = z
  .object({
    sourceKey: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(500),
    reviewerName: z.string().trim().min(1).max(255).nullable().default(null),
    nativeScore: NativeScoreSchema.nullable().default(null),
    normalizedRating: z.number().int().min(0).max(100).nullable().default(null),
  })
  .strict();

/**
 * Source adapters emit this strict article shape. Each review source key must
 * remain stable across runs; array position alone is not a stable key.
 */
export const ReviewArticleObservationSchema = z
  .object({
    canonicalUrl: z
      .url()
      .refine(
        (value) => ["http:", "https:"].includes(new URL(value).protocol),
        { message: "Canonical URL must use HTTP or HTTPS." },
      ),
    title: z.string().trim().min(1).max(1000),
    issue: z.string().trim().min(1).max(255).nullable().default(null),
    publishedAt: z.date().nullable().default(null),
    contentHash: z.string().trim().min(1).max(128),
    reviews: z.array(ReviewArticleReviewSchema).min(1),
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

export type ReviewArticleObservation = z.infer<
  typeof ReviewArticleObservationSchema
>;
