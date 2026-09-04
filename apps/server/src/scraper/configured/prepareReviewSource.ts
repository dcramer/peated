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
import { ScrapeSourceValidationError } from "./service";

const InputSchema = z
  .object({
    apply: z.boolean().default(false),
    createdById: z.number().int().positive(),
  })
  .strict();

export type PrepareReviewSourceInput = z.input<typeof InputSchema>;

type ReviewSourceDefinition = ExistingSourceDefinition & {
  listUrl: string;
  isCanonicalArticleUrl: (url: string) => boolean;
  legacyReviewKey: (url: string) => string;
};

/** Checks one single-review source by default; applying preserves records and leaves collection paused. */
export async function prepareReviewSource(
  input: PrepareReviewSourceInput,
  definition: ReviewSourceDefinition,
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
    const changes = articles.map((article) => {
      const articleReviews = reviewsByArticle.get(article.id) ?? [];
      // Review imports own these keys. One verified review per article avoids guessing.
      if (
        !definition.isCanonicalArticleUrl(article.url) ||
        articleReviews.length !== 1 ||
        articleReviews[0].sourceKey !== definition.legacyReviewKey(article.url)
      ) {
        throw new ScrapeSourceValidationError(
          `Check the URL and review records for ${definition.siteName} article ${article.id} before continuing.`,
        );
      }
      return { id: articleReviews[0].id, sourceKey: `${article.url}#review-1` };
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
