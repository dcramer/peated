import { db, type AnyTransaction } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  ExternalReviewArticleObservationSchema,
  ExternalReviewObservationSchema,
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

const StoredExternalReviewSchema = ExternalReviewObservationSchema.safeExtend({
  bottleId: z.number().int().positive().nullable().default(null),
  summary: StoredSummarySchema.nullable().default(null),
});

export const ExternalReviewArticleInputSchema =
  ExternalReviewArticleObservationSchema.safeExtend({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    externalReviews: z.array(StoredExternalReviewSchema).min(1),
  }).superRefine(({ contentHash, externalReviews }, context) => {
    for (const [index, externalReview] of externalReviews.entries()) {
      if (
        externalReview.summary &&
        externalReview.summary.contentHash !== contentHash
      ) {
        context.addIssue({
          code: "custom",
          message: "Summary content hash must match its article.",
          path: ["externalReviews", index, "summary", "contentHash"],
        });
      }
    }
  });

type ParsedExternalReviewArticleInput = z.infer<
  typeof ExternalReviewArticleInputSchema
>;
type ExternalReviewArticleInputValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | ExternalReviewArticleInputValue[]
  | { [key: string]: ExternalReviewArticleInputValue };
type ExternalReviewArticleInputCandidate = {
  [key: string]: ExternalReviewArticleInputValue;
};
type ExternalReviewArticleInput = Omit<
  ParsedExternalReviewArticleInput,
  "contentHash" | "fetchedAt" | "title"
> & {
  contentHash: string | null;
  fetchedAt: Date | null;
  title: string | null;
};
type ExternalReviewOrigin = "manual" | "source";
type InvalidBottleAction = "reject" | "stage";

/** Stores one article after locking its source, Bottles, and alias consumers. */
export async function storeExternalReviewArticleInTransaction(
  tx: AnyTransaction,
  input: ExternalReviewArticleInput,
  {
    origin,
    invalidBottleAction,
    aliasLookupNames = [],
  }: {
    origin: ExternalReviewOrigin;
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
    .insert(externalReviewArticles)
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
      target: [
        externalReviewArticles.externalSiteId,
        externalReviewArticles.canonicalUrl,
      ],
      set: articleUpdate,
    })
    .returning({ id: externalReviewArticles.id });
  if (!article) throw new Error("Unable to store external review article.");

  const invalidBottleIds = new Set<number>();
  const bottleIds = [
    ...new Set(
      input.externalReviews.flatMap(({ bottleId }) =>
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
      .update(externalReviews)
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
          eq(externalReviews.articleId, article.id),
          isNotNull(externalReviews.summary),
          ne(externalReviews.summaryContentHash, input.contentHash),
        ),
      );
  }

  const storedExternalReviews = [];

  for (const externalReview of input.externalReviews) {
    const [existing] = await tx
      .select()
      .from(externalReviews)
      .where(
        and(
          eq(externalReviews.articleId, article.id),
          eq(externalReviews.sourceKey, externalReview.sourceKey),
        ),
      )
      .limit(1)
      .for("update");
    const hasInvalidBottle =
      externalReview.bottleId !== null &&
      invalidBottleIds.has(externalReview.bottleId);
    const incomingBottleId = hasInvalidBottle ? null : externalReview.bottleId;
    const bottleId =
      incomingBottleId !== null &&
      (existing?.bottleId == null || existing.bottleId === incomingBottleId)
        ? incomingBottleId
        : (existing?.bottleId ?? null);
    const hidden = existing
      ? hasInvalidBottle &&
        (existing.bottleId === null ||
          existing.bottleId === externalReview.bottleId)
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
      typeof externalReviews.$inferInsert,
      "articleId" | "sourceKey" | "updatedAt"
    > = {
      bottleId,
      name: externalReview.name,
      nativeScoreValue: externalReview.nativeScore?.value ?? null,
      nativeScoreScale: externalReview.nativeScore?.scale ?? null,
      nativeScoreDisplay: externalReview.nativeScore?.display ?? null,
      hidden,
    };
    if (origin === "source") {
      values.category = externalReview.category;
      values.reviewerName = externalReview.reviewerName;
    }
    if (externalReview.summary) {
      values.summary = externalReview.summary.text;
      values.summaryContentHash = externalReview.summary.contentHash;
      values.summaryModel = externalReview.summary.model;
      values.summaryPromptVersion = externalReview.summary.promptVersion;
      values.summaryGeneratedAt = externalReview.summary.generatedAt;
    }
    const [stored] = existing
      ? await tx
          .update(externalReviews)
          .set({ ...values, updatedAt: sql`NOW()` })
          .where(eq(externalReviews.id, existing.id))
          .returning()
      : await tx
          .insert(externalReviews)
          .values({
            articleId: article.id,
            sourceKey: externalReview.sourceKey,
            ...values,
            updatedAt: sql`NOW()`,
          })
          .returning();
    if (!stored) throw new Error("Unable to store external review.");
    storedExternalReviews.push({
      externalReview: stored,
      previousBottleId: existing?.bottleId,
    });
  }

  return { articleId: article.id, storedExternalReviews };
}

/**
 * Stores external review metadata. The input excludes full review text, HTML,
 * tasting notes, conclusions, and images. Callers must discard those values
 * before they call this function.
 */
export async function storeExternalReviewArticle(
  rawInput: ExternalReviewArticleInputCandidate,
) {
  const input = ExternalReviewArticleInputSchema.parse(rawInput);

  const stored = await db.transaction(async (tx) => {
    const { articleId, storedExternalReviews } =
      await storeExternalReviewArticleInTransaction(tx, input, {
        origin: "source",
        invalidBottleAction: "stage",
      });
    return {
      articleId,
      externalReviewIds: storedExternalReviews.map(
        ({ externalReview }) => externalReview.id,
      ),
      changedExternalReviews: storedExternalReviews.map(
        ({ externalReview, previousBottleId }) => ({
          id: externalReview.id,
          bottleId: externalReview.bottleId,
          previousBottleId,
        }),
      ),
    };
  });

  await Promise.all(
    stored.changedExternalReviews.flatMap((externalReview) =>
      Array.from(
        new Set(
          [externalReview.previousBottleId, externalReview.bottleId].filter(
            (id): id is number => id !== null && id !== undefined,
          ),
        ),
      ).map((bottleId) =>
        dispatchBottleStatsRecompute(
          "externalReview",
          externalReview.id,
          bottleId,
        ),
      ),
    ),
  );
  return {
    articleId: stored.articleId,
    externalReviewIds: stored.externalReviewIds,
  };
}
