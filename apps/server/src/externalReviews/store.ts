import { db, type AnyTransaction } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  ExternalReviewArticleObservationSchema,
  ExternalReviewObservationSchema,
} from "@peated/server/externalReviews/observation";
import { isExternalReviewPublicationApprovedInTransaction } from "@peated/server/externalReviews/publication";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

const StoredExternalReviewSchema = ExternalReviewObservationSchema.safeExtend({
  bottleId: z.number().int().positive().nullable().default(null),
  clip: z.string().trim().min(1).max(180).nullable().optional(),
  tags: z.array(z.string().min(1).max(64)).optional(),
  body: z.string().trim().min(1).optional(),
});

export const ExternalReviewArticleInputSchema =
  ExternalReviewArticleObservationSchema.safeExtend({
    externalSiteId: z.number().int().positive(),
    fetchedAt: z.date(),
    externalReviews: z.array(StoredExternalReviewSchema).min(1),
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
    referenceLookupNames = [],
  }: {
    origin: ExternalReviewOrigin;
    invalidBottleAction: InvalidBottleAction;
    referenceLookupNames?: string[];
  },
) {
  const publicationApproved =
    await isExternalReviewPublicationApprovedInTransaction(
      tx,
      input.externalSiteId,
    );
  const publishesAutomatically = origin === "source" && publicationApproved;

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

  if (referenceLookupNames.length) {
    await tx
      .select({ id: storePrices.id })
      .from(storePrices)
      .where(
        and(
          eq(storePrices.externalSiteId, input.externalSiteId),
          or(
            ...referenceLookupNames.map((name) =>
              eq(sql`LOWER(${storePrices.name})`, name.toLowerCase()),
            ),
          ),
        ),
      )
      .for("update");
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
      if (externalReview.clip !== undefined) {
        values.clip = externalReview.clip;
      }
      // Review imports own these tags. Missing text keeps the previous tags;
      // supplied text replaces them, even when nothing matches.
      if (externalReview.tags !== undefined) {
        values.tags = [...new Set(externalReview.tags)].sort();
      }
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
    if (origin === "source" && externalReview.body !== undefined) {
      if (!input.fetchedAt)
        throw new Error("A scraped review body requires its fetch date.");
      await tx
        .insert(externalReviewBodies)
        .values({
          externalReviewId: stored.id,
          body: externalReview.body,
          fetchedAt: input.fetchedAt,
        })
        .onConflictDoUpdate({
          target: externalReviewBodies.externalReviewId,
          set: { body: externalReview.body, fetchedAt: input.fetchedAt },
        });
    }
    storedExternalReviews.push({
      externalReview: stored,
      previousBottleId: existing?.bottleId,
    });
  }

  return { articleId: article.id, storedExternalReviews };
}

/**
 * Stores review facts and optional internal bodies. Scrapers must convert the
 * selected review content to plain text before calling this function.
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
