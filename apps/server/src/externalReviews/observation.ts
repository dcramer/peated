import { CategoryEnum, NativeScoreSchema } from "@peated/server/schemas";
import { z } from "zod";

const MAX_REVIEW_TEXT_LENGTH = 50_000;
const ReviewSourceKeySchema = z.string().trim().min(1).max(255);

export const ExternalReviewObservationSchema = z
  .object({
    sourceKey: ReviewSourceKeySchema,
    name: z.string().trim().min(1).max(500),
    category: CategoryEnum.nullable().default(null),
    reviewerName: z.string().trim().min(1).max(255).nullable().default(null),
    nativeScore: NativeScoreSchema.nullable().default(null),
  })
  .strict();

/**
 * Source adapters emit this strict article shape. Each review source key must
 * remain stable across runs; array position alone is not a stable key.
 */
export const ExternalReviewArticleObservationSchema = z
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
    externalReviews: z.array(ExternalReviewObservationSchema).min(1),
  })
  .strict()
  .superRefine(({ externalReviews }, context) => {
    const sourceKeys = new Set<string>();
    for (const [index, review] of externalReviews.entries()) {
      if (sourceKeys.has(review.sourceKey)) {
        context.addIssue({
          code: "custom",
          message:
            "External review source keys must be unique within an article.",
          path: ["externalReviews", index, "sourceKey"],
        });
      }
      sourceKeys.add(review.sourceKey);
    }
  });

export type ExternalReviewArticleObservation = z.infer<
  typeof ExternalReviewArticleObservationSchema
>;

/** Shared adapter output. The sink passes this shape to article ingestion. */
export const ExternalReviewArticleIngestionSchema = z
  .object({
    article: ExternalReviewArticleObservationSchema,
    externalReviewTexts: z
      .record(
        ReviewSourceKeySchema,
        z.string().trim().min(1).max(MAX_REVIEW_TEXT_LENGTH),
      )
      .default({}),
  })
  .strict()
  .superRefine(({ article, externalReviewTexts }, context) => {
    const sourceKeys = new Set(
      article.externalReviews.map(({ sourceKey }) => sourceKey),
    );
    for (const sourceKey of Object.keys(externalReviewTexts)) {
      if (!sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          message:
            "External review text must match an external review source key.",
          path: ["externalReviewTexts", sourceKey],
        });
      }
    }
  });

export type ExternalReviewArticleIngestion = z.infer<
  typeof ExternalReviewArticleIngestionSchema
>;
