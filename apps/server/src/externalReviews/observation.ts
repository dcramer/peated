import {
  CategoryEnum,
  NativeScoreSchema,
  NormalizedReviewRatingSchema,
} from "@peated/server/schemas";
import { z } from "zod";

const MAX_REVIEW_TEXT_LENGTH = 50_000;

export function normalizeReviewRating(
  rawScore: z.input<typeof NativeScoreSchema>,
) {
  const score = NativeScoreSchema.parse(rawScore);
  return NormalizedReviewRatingSchema.parse(
    Math.round((score.value * 100) / score.scale),
  );
}

export const ReviewArticleReviewSchema = z
  .object({
    sourceKey: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(500),
    category: CategoryEnum.nullable().default(null),
    reviewerName: z.string().trim().min(1).max(255).nullable().default(null),
    nativeScore: NativeScoreSchema.nullable().default(null),
    normalizedRating: NormalizedReviewRatingSchema.nullable().default(null),
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

/** Shared adapter output. The sink passes this shape to article ingestion. */
export const ReviewArticleIngestionSchema = z
  .object({
    article: ReviewArticleObservationSchema,
    reviewTexts: z
      .record(
        ReviewArticleReviewSchema.shape.sourceKey,
        z.string().trim().min(1).max(MAX_REVIEW_TEXT_LENGTH),
      )
      .default({}),
  })
  .strict()
  .superRefine(({ article, reviewTexts }, context) => {
    const sourceKeys = new Set(
      article.reviews.map(({ sourceKey }) => sourceKey),
    );
    for (const sourceKey of Object.keys(reviewTexts)) {
      if (!sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          message: "Review text must match a review source key.",
          path: ["reviewTexts", sourceKey],
        });
      }
    }
  });

export type ReviewArticleIngestion = z.infer<
  typeof ReviewArticleIngestionSchema
>;
