import { db, type AnyTransaction } from "@peated/server/db";
import { reviewArticles, reviews, storePrices } from "@peated/server/db/schema";
import {
  ReviewArticleObservationSchema,
  ReviewArticleReviewSchema,
} from "@peated/server/externalReviews/observation";
import { getExternalReviewPublicationModeInTransaction } from "@peated/server/externalReviews/publication";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { and, eq, isNotNull, ne, or, sql } from "drizzle-orm";
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

type SourceReviewArticleInput = z.infer<typeof ReviewArticleInputSchema>;
type ReviewArticleInputValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ReviewArticleInputValue[]
  | { [key: string]: ReviewArticleInputValue };
type ReviewArticleInputCandidate = {
  [key: string]: ReviewArticleInputValue;
};
type ReviewArticleInput = Omit<
  SourceReviewArticleInput,
  "contentHash" | "fetchedAt" | "title"
> & {
  contentHash: string | null;
  fetchedAt: Date | null;
  title: string | null;
};
type ReviewOrigin = "manual" | "source";
type InvalidBottleAction = "reject" | "stage";

/** Stores one article after locking its source, Bottles, and alias consumers. */
export async function storeReviewArticleInTransaction(
  tx: AnyTransaction,
  input: ReviewArticleInput,
  {
    origin,
    invalidBottleAction,
    aliasLookupNames = [],
  }: {
    origin: ReviewOrigin;
    invalidBottleAction: InvalidBottleAction;
    aliasLookupNames?: string[];
  },
) {
  const publicationMode = await getExternalReviewPublicationModeInTransaction(
    tx,
    input.externalSiteId,
  );
  const publishesAutomatically =
    origin === "source" && publicationMode === "automatic";

  const articleUpdate =
    origin === "manual"
      ? { issue: input.issue, updatedAt: sql`NOW()` }
      : {
          title: input.title,
          issue: input.issue,
          publishedAt: input.publishedAt,
          contentHash: input.contentHash,
          fetchedAt: input.fetchedAt,
          updatedAt: sql`NOW()`,
        };
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
      set: articleUpdate,
    })
    .returning({ id: reviewArticles.id });
  if (!article) throw new Error("Unable to store review article.");

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
      if (invalidBottleAction === "reject") throw error;
      invalidBottleIds.add(bottleId);
    }
  }

  if (aliasLookupNames.length) {
    await tx
      .select({ id: storePrices.id })
      .from(storePrices)
      .where(
        and(
          eq(storePrices.externalSiteId, input.externalSiteId),
          or(
            ...aliasLookupNames.map((name) =>
              eq(sql`LOWER(${storePrices.name})`, name.toLowerCase()),
            ),
          ),
        ),
      )
      .for("update");
  }

  if (origin === "source" && input.contentHash !== null) {
    await tx
      .update(reviews)
      .set({
        summary: null,
        summaryContentHash: null,
        summaryModel: null,
        summaryPromptVersion: null,
        summaryGeneratedAt: null,
        updatedAt: sql<Date>`NOW()`,
      })
      .where(
        and(
          eq(reviews.articleId, article.id),
          isNotNull(reviews.summary),
          ne(reviews.summaryContentHash, input.contentHash),
        ),
      );
  }

  const storedReviews = [];

  for (const review of input.reviews) {
    const [existing] = await tx
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.articleId, article.id),
          eq(reviews.sourceKey, review.sourceKey),
        ),
      )
      .limit(1)
      .for("update");
    const hasInvalidBottle =
      review.bottleId !== null && invalidBottleIds.has(review.bottleId);
    const incomingBottleId = hasInvalidBottle ? null : review.bottleId;
    const bottleId =
      incomingBottleId !== null &&
      (existing?.bottleId == null || existing.bottleId === incomingBottleId)
        ? incomingBottleId
        : (existing?.bottleId ?? null);
    const hidden = existing
      ? hasInvalidBottle &&
        (existing.bottleId === null || existing.bottleId === review.bottleId)
        ? true
        : origin === "source" &&
            publishesAutomatically &&
            existing.bottleId === null &&
            bottleId !== null
          ? false
          : (existing.hidden ?? false)
      : origin === "source"
        ? !(publishesAutomatically && bottleId !== null)
        : false;
    const values: Omit<
      typeof reviews.$inferInsert,
      "articleId" | "sourceKey" | "updatedAt"
    > = {
      bottleId,
      name: review.name,
      legacyNormalizedScore: review.normalizedRating,
      nativeScoreValue: review.nativeScore?.value ?? null,
      nativeScoreScale: review.nativeScore?.scale ?? null,
      nativeScoreDisplay: review.nativeScore?.display ?? null,
      hidden,
    };
    if (origin === "source") {
      values.category = review.category;
      values.reviewerName = review.reviewerName;
    }
    if (review.summary) {
      values.summary = review.summary.text;
      values.summaryContentHash = review.summary.contentHash;
      values.summaryModel = review.summary.model;
      values.summaryPromptVersion = review.summary.promptVersion;
      values.summaryGeneratedAt = review.summary.generatedAt;
    }
    const [stored] = existing
      ? await tx
          .update(reviews)
          .set({ ...values, updatedAt: sql`NOW()` })
          .where(eq(reviews.id, existing.id))
          .returning()
      : await tx
          .insert(reviews)
          .values({
            articleId: article.id,
            sourceKey: review.sourceKey,
            ...values,
            updatedAt: sql`NOW()`,
          })
          .returning();
    if (!stored) throw new Error("Unable to store review.");
    storedReviews.push({
      review: stored,
      previousBottleId: existing?.bottleId,
    });
  }

  return { articleId: article.id, storedReviews };
}

/**
 * Stores external review metadata. The input excludes full review text, HTML,
 * tasting notes, conclusions, and images. Callers must discard those values
 * before they call this function.
 */
export async function storeReviewArticle(
  rawInput: ReviewArticleInputCandidate,
) {
  const input = ReviewArticleInputSchema.parse(rawInput);

  const stored = await db.transaction(async (tx) => {
    const { articleId, storedReviews } = await storeReviewArticleInTransaction(
      tx,
      input,
      {
        origin: "source",
        invalidBottleAction: "stage",
      },
    );
    return {
      articleId,
      reviewIds: storedReviews.map(({ review }) => review.id),
      changedReviews: storedReviews.map(({ review, previousBottleId }) => ({
        id: review.id,
        bottleId: review.bottleId,
        previousBottleId,
      })),
    };
  });

  await Promise.all(
    stored.changedReviews.flatMap((review) =>
      Array.from(
        new Set(
          [review.previousBottleId, review.bottleId].filter(
            (id): id is number => id !== null && id !== undefined,
          ),
        ),
      ).map((bottleId) =>
        dispatchBottleStatsRecompute("externalReview", review.id, bottleId),
      ),
    ),
  );
  return { articleId: stored.articleId, reviewIds: stored.reviewIds };
}
