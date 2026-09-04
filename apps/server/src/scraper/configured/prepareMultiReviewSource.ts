import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createPreparedSource,
  inspectExistingSource,
  type ExistingSourceDefinition,
} from "./prepareExistingSource";
import type { PrepareReviewSourceInput } from "./prepareReviewSource";
import { ScrapeSourceValidationError } from "./service";

const InputSchema = z
  .object({
    apply: z.boolean().default(false),
    createdById: z.number().int().positive(),
  })
  .strict();

type MultiReviewSourceDefinition = ExistingSourceDefinition & {
  listUrl: string;
  isCanonicalArticleUrl: (url: string) => boolean;
  legacyReviewKey: (review: {
    articleUrl: string;
    name: string;
    reviewerName: string | null;
  }) => string;
};

/** Checks every review identity before assigning configured-parser positions. */
export async function prepareMultiReviewSource(
  input: PrepareReviewSourceInput,
  definition: MultiReviewSourceDefinition,
) {
  const { apply, createdById } = InputSchema.parse(input);
  return db.transaction(async (tx) => {
    const site = await inspectExistingSource(tx, definition);
    const articles = await tx
      .select({
        id: externalReviewArticles.id,
        url: externalReviewArticles.canonicalUrl,
      })
      .from(externalReviewArticles)
      .where(eq(externalReviewArticles.externalSiteId, site.id))
      .for("update");
    const reviews = await tx
      .select({
        id: externalReviews.id,
        articleId: externalReviews.articleId,
        sourceKey: externalReviews.sourceKey,
        name: externalReviews.name,
        reviewerName: externalReviews.reviewerName,
      })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviewArticles.id, externalReviews.articleId),
      )
      .where(eq(externalReviewArticles.externalSiteId, site.id))
      .for("update");
    const reviewsByArticle = new Map<number, typeof reviews>();
    for (const review of reviews) {
      const group = reviewsByArticle.get(review.articleId) ?? [];
      group.push(review);
      reviewsByArticle.set(review.articleId, group);
    }

    const changes = articles.flatMap((article) => {
      const articleReviews = reviewsByArticle.get(article.id) ?? [];
      if (
        !definition.isCanonicalArticleUrl(article.url) ||
        articleReviews.length === 0
      ) {
        throw new ScrapeSourceValidationError(
          `Check the URL and review records for ${definition.siteName} article ${article.id} before continuing.`,
        );
      }
      // The review store inserts an article's emitted reviews in order and never
      // replaces their IDs. That stored order owns configured review positions.
      return articleReviews
        .toSorted((left, right) => left.id - right.id)
        .map((review, index) => {
          const expectedKey = definition.legacyReviewKey({
            articleUrl: article.url,
            name: review.name,
            reviewerName: review.reviewerName,
          });
          if (review.sourceKey !== expectedKey) {
            throw new ScrapeSourceValidationError(
              `Check the URL and review records for ${definition.siteName} article ${article.id} before continuing.`,
            );
          }
          return {
            id: review.id,
            sourceKey: `${article.url}#review-${index + 1}`,
          };
        });
    });

    let scrapeSourceId: number | null = null;
    if (apply) {
      for (const change of changes) {
        await tx
          .update(externalReviews)
          .set({ sourceKey: change.sourceKey })
          .where(eq(externalReviews.id, change.id));
      }
      scrapeSourceId = await createPreparedSource(
        tx,
        {
          externalSiteId: site.id,
          kind: "review",
          listUrl: definition.listUrl,
          createdById,
        },
        definition,
      );
    }
    return {
      siteId: site.id,
      scrapeSourceId,
      reviewCount: changes.length,
      applied: apply,
    };
  });
}
